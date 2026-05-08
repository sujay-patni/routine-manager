import { addHours, format, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { NormalizedRecord, WebhookPayload } from "./types";

/** Records spanning at least this many minutes are treated as daily-aggregate
 *  totals (e.g. Samsung Health's 24h "Combined" StepsRecord). They overwrite
 *  bout-level sums for the same logical day, since the aggregate is the
 *  authoritative merged count from the source. Real activity bouts top out
 *  around 10 minutes, so 22h is far above the noise. */
const AGGREGATE_MIN_MINUTES = 22 * 60;

/** Convert an ISO timestamp to the logical day key (YYYY-MM-DD), shifted by
 *  the user's day_start_hour. A measurement at 02:00 with day_start_hour=4
 *  belongs to the previous day. Mirrors getEffectiveDate() in habit-logic.ts. */
function timestampToDayKey(iso: string, timezone: string, dayStartHour: number): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  const effective = dayStartHour > 0 && zoned.getHours() < dayStartHour ? subDays(zoned, 1) : zoned;
  return format(effective, "yyyy-MM-dd");
}

function midpointIso(startIso: string, endIso: string): string {
  return new Date((Date.parse(startIso) + Date.parse(endIso)) / 2).toISOString();
}

/** UTC bounds of the logical day identified by dayKey. Used to decide whether
 *  the day is fully inside [data_window_start, webhook_timestamp]. */
function logicalDayBoundsUtc(dayKey: string, timezone: string, dayStartHour: number) {
  const hh = String(dayStartHour).padStart(2, "0");
  const startUtc = fromZonedTime(`${dayKey}T${hh}:00:00`, timezone);
  return { startUtc, endUtc: addHours(startUtc, 24) };
}

interface Bucket {
  progressValue: number;
  durationMinutes?: number;
}

/** Aggregates webhook records by (source, dayKey) and decides which days are
 *  safe to write. For steps, daily-aggregate records (≥22h) are bucketed by
 *  midpoint and override bout sums on the same dayKey; bout durations are
 *  still kept as the "active walking time" proxy. Past days that fall only
 *  partially inside the sender's data window are filtered out so a partial
 *  sync at, say, 1 AM cannot overwrite a previously-complete day. */
export function parseWebhookPayload(
  payload: WebhookPayload,
  timezone: string,
  dayStartHour: number
): NormalizedRecord[] {
  // Steps: aggregates and bouts tracked separately so aggregate-wins works.
  const stepsAggregateCounts = new Map<string, number>();
  const stepsBouts = new Map<string, Bucket>();

  for (const r of payload.steps ?? []) {
    const minutes = (Date.parse(r.end_time) - Date.parse(r.start_time)) / 60000;
    if (minutes >= AGGREGATE_MIN_MINUTES) {
      const dayKey = timestampToDayKey(midpointIso(r.start_time, r.end_time), timezone, dayStartHour);
      stepsAggregateCounts.set(dayKey, (stepsAggregateCounts.get(dayKey) ?? 0) + r.count);
    } else {
      const dayKey = timestampToDayKey(r.start_time, timezone, dayStartHour);
      const existing = stepsBouts.get(dayKey) ?? { progressValue: 0 };
      existing.progressValue += r.count;
      if (minutes > 0) existing.durationMinutes = (existing.durationMinutes ?? 0) + minutes;
      stepsBouts.set(dayKey, existing);
    }
  }

  // Sleep / distance / active_calories: simple bucketing by logical day.
  const otherBuckets = new Map<string, Bucket>();
  const otherKey = (source: string, dayKey: string) => `${source}|${dayKey}`;
  const addOther = (source: string, dayKey: string, value: number, durationMinutes?: number) => {
    const k = otherKey(source, dayKey);
    const existing = otherBuckets.get(k);
    if (existing) {
      existing.progressValue += value;
      if (durationMinutes != null) {
        existing.durationMinutes = (existing.durationMinutes ?? 0) + durationMinutes;
      }
    } else {
      otherBuckets.set(k, { progressValue: value, durationMinutes });
    }
  };

  for (const r of payload.sleep ?? []) {
    const minutes = r.duration_seconds / 60;
    addOther("sleep_minutes", timestampToDayKey(r.session_end_time, timezone, dayStartHour), minutes, minutes);
  }
  for (const r of payload.distance ?? []) {
    addOther("distance_meters", timestampToDayKey(r.start_time, timezone, dayStartHour), r.meters);
  }
  for (const r of payload.active_calories ?? []) {
    addOther("active_calories", timestampToDayKey(r.start_time, timezone, dayStartHour), r.calories);
  }

  // Safe-to-write check: aggregate days are always authoritative; "today"
  // always updates (in-progress); past days only if fully inside the window.
  const webhookTs = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const dwsRaw = payload.sync?.data_window_start;
  const dataWindowStart = dwsRaw ? new Date(dwsRaw) : undefined;
  const todayKey = timestampToDayKey(webhookTs.toISOString(), timezone, dayStartHour);

  function isSafeToWrite(dayKey: string, hasAggregate: boolean): boolean {
    if (hasAggregate) return true;
    if (dayKey === todayKey) return true;
    if (!dataWindowStart) return true; // back-compat: older sender without window info
    const { startUtc, endUtc } = logicalDayBoundsUtc(dayKey, timezone, dayStartHour);
    return startUtc >= dataWindowStart && endUtc <= webhookTs;
  }

  const out: NormalizedRecord[] = [];

  // Emit steps with aggregate-wins-on-count, duration-from-bouts.
  const stepsDayKeys = new Set([...stepsAggregateCounts.keys(), ...stepsBouts.keys()]);
  for (const dayKey of stepsDayKeys) {
    const aggCount = stepsAggregateCounts.get(dayKey);
    const bouts = stepsBouts.get(dayKey);
    if (!isSafeToWrite(dayKey, aggCount !== undefined)) continue;
    out.push({
      source: "steps",
      dayKey,
      progressValue: aggCount ?? bouts?.progressValue ?? 0,
      durationMinutes: bouts?.durationMinutes,
    });
  }

  // Emit other sources.
  for (const [k, bucket] of otherBuckets) {
    const [source, dayKey] = k.split("|");
    if (!isSafeToWrite(dayKey, false)) continue;
    out.push({
      source: source as NormalizedRecord["source"],
      dayKey,
      progressValue: bucket.progressValue,
      durationMinutes: bucket.durationMinutes,
    });
  }

  return out;
}
