"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import {
  getAppSettings,
  createAppSettings,
  updateAppSettings,
} from "@/lib/db/settings";
import type { AppSettings } from "@/lib/domain/types";

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
    if (!process.env.DATABASE_URL?.trim()) return getEnvSettings();
    const dbSettings = await getAppSettings();
    return dbSettings ?? getEnvSettings();
  },
  ["app-settings"],
  { revalidate: 300, tags: ["app-settings"] }
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
    revalidateTag("app-settings", {});
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
