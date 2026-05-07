import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID, timingSafeEqual } from "crypto";
import { getAllHabits, upsertCompletion } from "@/lib/notion/habits";
import { getAppSettings } from "@/lib/notion/settings";
import { parseWebhookPayload } from "@/lib/health/normalize";
import { webhookPayloadSchema, type HealthSource } from "@/lib/health/types";

export const dynamic = "force-dynamic";

function unauthorized(reason: string) {
  return Response.json({ ok: false, error: reason }, { status: 401 });
}

function badRequest(reason: string, details?: unknown) {
  return Response.json({ ok: false, error: reason, details }, { status: 400 });
}

function unprocessable(reason: string, details?: unknown) {
  return Response.json({ ok: false, error: reason, details }, { status: 422 });
}

function serverError(reason: string, details?: unknown) {
  return Response.json({ ok: false, error: reason, details }, { status: 500 });
}

function withDebug(body: Record<string, unknown>, debug: boolean, diagnostics: Diagnostics) {
  return debug ? { ...body, debug: diagnostics } : body;
}

function checkBearer(req: Request): boolean {
  const secret = process.env.HEALTH_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const presented = match[1].trim();
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function payloadCounts(raw: unknown): Record<string, number> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, (value as unknown[]).length])
  );
}

type UpsertDiagnostic =
  | {
      source: string;
      dayKey: string;
      habitName: string;
      progressValue: number;
      durationMinutes?: number;
      created: boolean;
      completionId: string;
      result: "upserted";
    }
  | {
      source: string;
      dayKey: string;
      progressValue: number;
      durationMinutes?: number;
      result: "unmapped" | "error";
      error?: string;
    };

interface Diagnostics {
  requestId: string;
  receivedArrays: Record<string, number>;
  settings?: {
    timezone: string;
    dayStartHour: number;
  };
  normalizedRecords: Array<{
    source: string;
    dayKey: string;
    progressValue: number;
    durationMinutes?: number;
  }>;
  mappedSources: Array<{ source: string; habitName: string }>;
  upserts: UpsertDiagnostic[];
}

function logDiagnostics(
  message: string,
  diagnostics: Diagnostics,
  extra?: Record<string, unknown>,
  force = false
) {
  if (!force && process.env.HEALTH_WEBHOOK_DEBUG !== "1") return;

  console.info(
    "[health-webhook]",
    message,
    JSON.stringify({
      requestId: diagnostics.requestId,
      receivedArrays: diagnostics.receivedArrays,
      settings: diagnostics.settings,
      normalizedRecords: diagnostics.normalizedRecords,
      mappedSources: diagnostics.mappedSources,
      upserts: diagnostics.upserts,
      ...extra,
    })
  );
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const debugResponse =
    process.env.HEALTH_WEBHOOK_DEBUG === "1" ||
    new URL(req.url).searchParams.get("debug") === "1";

  if (!process.env.HEALTH_WEBHOOK_SECRET?.trim()) {
    return unauthorized("HEALTH_WEBHOOK_SECRET is not configured on the server");
  }
  if (!checkBearer(req)) {
    return unauthorized("invalid or missing bearer token");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    console.warn("[health-webhook]", "invalid-json", JSON.stringify({ requestId }));
    return badRequest("body is not valid JSON");
  }

  const receivedArrays = payloadCounts(raw);
  const diagnostics: Diagnostics = {
    requestId,
    receivedArrays,
    normalizedRecords: [],
    mappedSources: [],
    upserts: [],
  };

  if (process.env.HEALTH_WEBHOOK_DEBUG === "1") {
    console.info("[health-webhook]", "received", JSON.stringify({ requestId, receivedArrays }));
  }

  const parsed = webhookPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logDiagnostics(
      "schema-validation-failed",
      diagnostics,
      {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      true
    );
    return badRequest("payload failed schema validation", parsed.error.flatten());
  }

  const settings = await getAppSettings();
  const timezone = settings?.timezone ?? "UTC";
  const dayStartHour = settings?.day_start_hour ?? 0;
  diagnostics.settings = { timezone, dayStartHour };

  const records = parseWebhookPayload(parsed.data, timezone, dayStartHour);
  diagnostics.normalizedRecords = records.map((rec) => ({
    source: rec.source,
    dayKey: rec.dayKey,
    progressValue: rec.progressValue,
    durationMinutes: rec.durationMinutes,
  }));
  const supportedInputCount =
    arrayCount(parsed.data.steps) +
    arrayCount(parsed.data.sleep) +
    arrayCount(parsed.data.distance) +
    arrayCount(parsed.data.active_calories);

  if (records.length === 0) {
    const incomingRecordCount = Object.values(receivedArrays).reduce((sum, count) => sum + count, 0);
    if (incomingRecordCount > 0) {
      const body = {
        received: receivedArrays,
        supported: ["steps", "sleep", "distance", "active_calories"],
      };
      logDiagnostics("unsupported-records", diagnostics, body, true);
      return unprocessable(
        "payload had records, but none are supported by this receiver",
        withDebug(body, debugResponse, diagnostics)
      );
    }
    const body = { ok: true, upserted: 0, skipped: "no records in payload" };
    logDiagnostics("empty-payload", diagnostics);
    return Response.json(withDebug(body, debugResponse, diagnostics));
  }

  const habits = await getAllHabits();
  const habitsBySource = new Map<HealthSource, (typeof habits)[number]>();
  for (const h of habits) {
    if (h.health_source) {
      habitsBySource.set(h.health_source, h);
      diagnostics.mappedSources.push({ source: h.health_source, habitName: h.name });
    }
  }

  let upserted = 0;
  let unmapped = 0;
  const errors: Array<{ source: string; dayKey: string; error: string }> = [];

  for (const rec of records) {
    const habit = habitsBySource.get(rec.source);
    if (!habit) {
      unmapped++;
      diagnostics.upserts.push({
        source: rec.source,
        dayKey: rec.dayKey,
        progressValue: rec.progressValue,
        durationMinutes: rec.durationMinutes,
        result: "unmapped",
      });
      continue;
    }
    try {
      const result = await upsertCompletion(
        habit.id,
        rec.dayKey,
        habit.name,
        rec.progressValue,
        rec.durationMinutes
      );
      upserted++;
      diagnostics.upserts.push({
        source: rec.source,
        dayKey: rec.dayKey,
        habitName: habit.name,
        progressValue: rec.progressValue,
        durationMinutes: rec.durationMinutes,
        created: result.created,
        completionId: result.id,
        result: "upserted",
      });
    } catch (e) {
      const error = String(e);
      errors.push({ source: rec.source, dayKey: rec.dayKey, error });
      diagnostics.upserts.push({
        source: rec.source,
        dayKey: rec.dayKey,
        progressValue: rec.progressValue,
        durationMinutes: rec.durationMinutes,
        result: "error",
        error,
      });
    }
  }

  if (upserted > 0) {
    revalidateTag("completions", {});
    revalidatePath("/today");
    revalidatePath("/calendar");
  }

  const body = {
    ok: errors.length === 0,
    upserted,
    unmapped,
    supportedInputCount,
    errors: errors.length > 0 ? errors : undefined,
  };

  if (errors.length > 0) {
    logDiagnostics("write-errors", diagnostics, body, true);
    return serverError(
      "one or more health records failed to write",
      withDebug(body, debugResponse, diagnostics)
    );
  }
  if (upserted === 0 && unmapped > 0) {
    logDiagnostics("unmapped-records", diagnostics, body, true);
    return unprocessable(
      "health records were received, but no active habit is mapped",
      withDebug(body, debugResponse, diagnostics)
    );
  }

  logDiagnostics("processed", diagnostics, body);
  return Response.json(withDebug(body, debugResponse, diagnostics));
}
