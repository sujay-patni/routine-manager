import { notifyDataChanged } from "../store";
import { getAppSettings, createAppSettings, updateAppSettings } from "../db/settings";
import type { AppSettings } from "../types";

export type { AppSettings };

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function defaultSettings(): AppSettings {
  return {
    id: "app",
    timezone: deviceTimezone(),
    week_start_day: 1,
    deadline_surface_days: 3,
    day_start_hour: 0,
    progress_units: ["mins", "hrs"],
  };
}

// Settings are read on almost every screen, so keep the last value in memory.
let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;
  cache = (await getAppSettings()) ?? defaultSettings();
  return cache;
}

export function clearSettingsCache() {
  cache = null;
}

export async function saveSettings(data: {
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
  day_start_hour: number;
  progress_units?: string[];
}) {
  try {
    const existing = await getAppSettings();
    if (existing) {
      await updateAppSettings(existing.id, data);
    } else {
      await createAppSettings({ ...data, progress_units: data.progress_units ?? ["mins", "hrs"] });
    }
    cache = null;
    notifyDataChanged();
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
