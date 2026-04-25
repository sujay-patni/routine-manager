"use server";

import { revalidatePath, unstable_cache } from "next/cache";
import {
  getAppSettings,
  createAppSettings,
  updateAppSettings,
} from "@/lib/notion/settings";
import type { AppSettings } from "@/lib/notion/types";

export type { AppSettings };

function getEnvSettings(): AppSettings {
  return {
    id: "env",
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    week_start_day: Number(process.env.WEEK_START_DAY ?? 1),
    deadline_surface_days: Number(process.env.DEADLINE_SURFACE_DAYS ?? 3),
    day_start_hour: Number(process.env.DAY_START_HOUR ?? 0),
    progress_units: ["mins", "hrs"],
  };
}

const getCachedSettings = unstable_cache(
  async (): Promise<AppSettings> => {
    const notionSettings = await getAppSettings();
    return notionSettings ?? getEnvSettings();
  },
  ["app-settings"],
  { revalidate: 300 }
);

export async function getSettings(): Promise<AppSettings> {
  return getCachedSettings();
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
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
