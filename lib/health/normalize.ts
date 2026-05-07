import { format, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { NormalizedRecord, WebhookPayload } from "./types";

/** Convert an ISO timestamp to the logical day key (YYYY-MM-DD), shifted by
 *  the user's day_start_hour. A measurement at 02:00 with day_start_hour=4
 *  belongs to the previous day. Mirrors getEffectiveDate() in habit-logic.ts. */
function timestampToDayKey(iso: string, timezone: string, dayStartHour: number): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  const effective = dayStartHour > 0 && zoned.getHours() < dayStartHour ? subDays(zoned, 1) : zoned;
  return format(effective, "yyyy-MM-dd");
}

interface Bucket {
  progressValue: number;
  durationMinutes?: number;
}

/** Aggregates webhook records by (source, dayKey). Works whether the sender
 *  emits one daily aggregate per metric (upstream HC Webhook) or many raw
 *  per-record entries (fork with readRecords(StepsRecord)) — every record's
 *  start_time is bucketed independently and summed by logical day. */
export function parseWebhookPayload(
  payload: WebhookPayload,
  timezone: string,
  dayStartHour: number
): NormalizedRecord[] {
  const buckets = new Map<string, Bucket>();
  const key = (source: string, dayKey: string) => `${source}|${dayKey}`;
  const add = (source: string, dayKey: string, value: number, durationMinutes?: number) => {
    const k = key(source, dayKey);
    const existing = buckets.get(k);
    if (existing) {
      existing.progressValue += value;
      if (durationMinutes != null) {
        existing.durationMinutes = (existing.durationMinutes ?? 0) + durationMinutes;
      }
    } else {
      buckets.set(k, { progressValue: value, durationMinutes });
    }
  };

  for (const r of payload.steps ?? []) {
    const minutes = (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000;
    // A record covering >60 min is almost certainly an upstream calendar-day
    // aggregate (24h span). Skip duration to avoid polluting duration_actual
    // with 1440. Per-record entries from the fork (1–15 min) are summed.
    const useDuration = minutes > 0 && minutes <= 60;
    add(
      "steps",
      timestampToDayKey(r.start_time, timezone, dayStartHour),
      r.count,
      useDuration ? minutes : undefined
    );
  }

  // Sleep is attributed to the day the session ENDED.
  for (const r of payload.sleep ?? []) {
    const minutes = r.duration_seconds / 60;
    const dayKey = timestampToDayKey(r.session_end_time, timezone, dayStartHour);
    add("sleep_minutes", dayKey, minutes, minutes);
  }

  for (const r of payload.distance ?? []) {
    add("distance_meters", timestampToDayKey(r.start_time, timezone, dayStartHour), r.meters);
  }

  for (const r of payload.active_calories ?? []) {
    add("active_calories", timestampToDayKey(r.start_time, timezone, dayStartHour), r.calories);
  }

  return [...buckets.entries()].map(([k, bucket]) => {
    const [source, dayKey] = k.split("|");
    return {
      source: source as NormalizedRecord["source"],
      dayKey,
      progressValue: bucket.progressValue,
      durationMinutes: bucket.durationMinutes,
    };
  });
}
