import { z } from "zod";

export const HEALTH_SOURCES = [
  "steps",
  "sleep_minutes",
  "distance_meters",
  "active_calories",
] as const;

export type HealthSource = (typeof HEALTH_SOURCES)[number];

export function isHealthSource(value: unknown): value is HealthSource {
  return typeof value === "string" && (HEALTH_SOURCES as readonly string[]).includes(value);
}

const stepsRecord = z.object({
  count: z.number(),
  start_time: z.string(),
  end_time: z.string(),
});

const sleepRecord = z.object({
  session_end_time: z.string(),
  duration_seconds: z.number(),
});

const distanceRecord = z.object({
  meters: z.number(),
  start_time: z.string(),
  end_time: z.string(),
});

const activeCaloriesRecord = z.object({
  calories: z.number(),
  start_time: z.string(),
  end_time: z.string(),
});

/** Sync-block metadata from the sender. `data_window_start` (added in
 *  hc-connect 1.8.5) tells the receiver the earliest UTC instant covered
 *  by this read, so we can avoid overwriting past logical days that fall
 *  only partially inside the lookback window. Other fields are diagnostic. */
const syncMetadataSchema = z.object({
  trigger: z.string().optional(),
  explicit_range: z.boolean().optional(),
  time_range_days: z.number().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  interval_full_lookback: z.boolean().optional(),
  used_last_sync_filter: z.boolean().optional(),
  data_window_start: z.string().optional(),
}).passthrough();

/** Schema for the HC Webhook payload (sujay-patni/health-connect-webhook, a
 *  fork of mcnaveen's). Only the fields we actually consume are validated;
 *  other top-level keys (heart_rate, weight, etc.) are accepted and ignored.
 *  Each array is optional — the sender omits a key entirely when there are
 *  no records of that type. Unsupported health arrays are accepted and
 *  ignored by this receiver. The `steps` array is per-`StepsRecord` from
 *  the fork (daily aggregates from upstream also work — the normalizer
 *  treats long-duration records as authoritative day totals). */
export const webhookPayloadSchema = z.object({
  timestamp: z.string().optional(),
  app_version: z.string().optional(),
  sync: syncMetadataSchema.optional(),
  steps: z.array(stepsRecord).optional(),
  sleep: z.array(sleepRecord).optional(),
  distance: z.array(distanceRecord).optional(),
  active_calories: z.array(activeCaloriesRecord).optional(),
}).passthrough();

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export interface NormalizedRecord {
  source: HealthSource;
  /** Logical day key in YYYY-MM-DD, already adjusted for day_start_hour. */
  dayKey: string;
  /** Value to write to Completion.progress_value. */
  progressValue: number;
  /** Optional minutes for Completion.duration_actual (sleep only). */
  durationMinutes?: number;
}
