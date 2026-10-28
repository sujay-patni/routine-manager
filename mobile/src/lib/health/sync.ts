// Reads health data straight from Android Health Connect and writes it into
// habits that have a health_source set. Replaces the web app's webhook.
import { Platform } from "react-native";
import { addHours, format, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
} from "react-native-health-connect";
import { getAllHabits, upsertCompletion } from "../db/habits";
import { getSettings } from "../services/settings";
import { notifyDataChanged } from "../store";
import type { HealthSource } from "../types";

const RECORD_TYPES: Record<HealthSource, RecordType> = {
  steps: "Steps",
  distance_meters: "Distance",
  sleep_minutes: "SleepSession",
  active_calories: "ActiveCaloriesBurned",
};

const PERMISSIONS: Permission[] = Object.values(RECORD_TYPES).map((recordType) => ({
  accessType: "read",
  recordType,
}));

/** Step records at least this long are whole-day totals, not walking bouts. */
const AGGREGATE_MIN_MINUTES = 22 * 60;

export type HealthStatus = "unsupported" | "not_installed" | "needs_update" | "ready";

let initialized = false;

async function ensureInit(): Promise<boolean> {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== "android") return "unsupported";
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return "ready";
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "needs_update";
    return "not_installed";
  } catch {
    return "unsupported";
  }
}

export async function getGrantedSources(): Promise<HealthSource[]> {
  if ((await getHealthStatus()) !== "ready" || !(await ensureInit())) return [];
  const granted = await getGrantedPermissions();
  const grantedTypes = new Set(
    granted.filter((p) => p.accessType === "read").map((p) => p.recordType as string)
  );
  return (Object.keys(RECORD_TYPES) as HealthSource[]).filter((s) => grantedTypes.has(RECORD_TYPES[s]));
}

export async function connectHealth(): Promise<HealthSource[]> {
  if (!(await ensureInit())) throw new Error("Health Connect could not start on this phone.");
  await requestPermission(PERMISSIONS);
  return getGrantedSources();
}

export function openHealthSettings() {
  openHealthConnectSettings();
}

/** Logical day key, shifted by day_start_hour (02:00 with a 4am day start
 *  belongs to the previous day). Mirrors getEffectiveDate() in habit-logic. */
function dayKeyFor(date: Date, timezone: string, dayStartHour: number): string {
  const zoned = toZonedTime(date, timezone);
  const effective = dayStartHour > 0 && zoned.getHours() < dayStartHour ? subDays(zoned, 1) : zoned;
  return format(effective, "yyyy-MM-dd");
}

function dayBounds(dayKey: string, timezone: string, dayStartHour: number) {
  const hh = String(dayStartHour).padStart(2, "0");
  const start = fromZonedTime(`${dayKey}T${hh}:00:00`, timezone);
  return { start, end: addHours(start, 24) };
}

async function readAll<T extends RecordType>(recordType: T, startTime: string, endTime: string) {
  const out = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, {
      timeRangeFilter: { operator: "between", startTime, endTime },
      pageToken,
    });
    out.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return out;
}

interface DayValue {
  value: number;
  durationMinutes?: number;
}

async function readSource(
  source: HealthSource,
  dayKeys: string[],
  timezone: string,
  dayStartHour: number
): Promise<Map<string, DayValue>> {
  const result = new Map<string, DayValue>();
  const now = new Date();

  if (source === "sleep_minutes") {
    // A night spans midnight, so file each session under the day it ended.
    const first = dayBounds(dayKeys[dayKeys.length - 1], timezone, dayStartHour).start;
    const sessions = await readAll("SleepSession", subDays(first, 1).toISOString(), now.toISOString());
    for (const s of sessions) {
      const key = dayKeyFor(new Date(s.endTime), timezone, dayStartHour);
      if (!dayKeys.includes(key)) continue;
      const minutes = (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000;
      const cur = result.get(key) ?? { value: 0, durationMinutes: 0 };
      cur.value += minutes;
      cur.durationMinutes = (cur.durationMinutes ?? 0) + minutes;
      result.set(key, cur);
    }
    return result;
  }

  for (const key of dayKeys) {
    const { start, end } = dayBounds(key, timezone, dayStartHour);
    const endTime = (end > now ? now : end).toISOString();
    const startTime = start.toISOString();
    const timeRangeFilter = { operator: "between" as const, startTime, endTime };

    if (source === "steps") {
      // Health Connect's aggregate removes duplicates across apps and devices.
      const agg = await aggregateRecord({ recordType: "Steps", timeRangeFilter });
      const bouts = await readAll("Steps", startTime, endTime);
      let boutMinutes = 0;
      for (const b of bouts) {
        const m = (Date.parse(b.endTime) - Date.parse(b.startTime)) / 60000;
        if (m > 0 && m < AGGREGATE_MIN_MINUTES) boutMinutes += m;
      }
      result.set(key, { value: agg.COUNT_TOTAL ?? 0, durationMinutes: boutMinutes || undefined });
    } else if (source === "distance_meters") {
      const agg = await aggregateRecord({ recordType: "Distance", timeRangeFilter });
      result.set(key, { value: agg.DISTANCE?.inMeters ?? 0 });
    } else if (source === "active_calories") {
      const agg = await aggregateRecord({ recordType: "ActiveCaloriesBurned", timeRangeFilter });
      result.set(key, { value: agg.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0 });
    }
  }
  return result;
}

export interface HealthSyncResult {
  updated: number;
  sources: HealthSource[];
}

let inFlight: Promise<HealthSyncResult> | null = null;

/** Pulls the last `days` logical days for every mapped habit. Safe to call
 *  often: concurrent calls share one run, and days with no data are left alone. */
export function syncHealth(days = 7): Promise<HealthSyncResult> {
  if (!inFlight) {
    inFlight = runSync(days).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(days: number): Promise<HealthSyncResult> {
  const granted = await getGrantedSources();
  if (granted.length === 0) return { updated: 0, sources: [] };

  const { timezone, day_start_hour: dayStartHour } = await getSettings();
  const habits = (await getAllHabits()).filter((h) => h.health_source && granted.includes(h.health_source));
  if (habits.length === 0) return { updated: 0, sources: granted };

  const todayKey = dayKeyFor(new Date(), timezone, dayStartHour);
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const { start } = dayBounds(todayKey, timezone, dayStartHour);
    dayKeys.push(dayKeyFor(addHours(subDays(start, i), 12), timezone, dayStartHour));
  }

  let updated = 0;
  for (const habit of habits) {
    const values = await readSource(habit.health_source!, dayKeys, timezone, dayStartHour);
    for (const [dayKey, v] of values) {
      if (v.value <= 0) continue;
      const value = Math.round(v.value);
      const duration = v.durationMinutes != null ? Math.round(v.durationMinutes) : undefined;
      await upsertCompletion(habit.id, dayKey, habit.name, value, duration);
      updated++;
    }
  }
  if (updated > 0) notifyDataChanged();
  return { updated, sources: granted };
}
