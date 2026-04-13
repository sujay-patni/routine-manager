"use server";

import { revalidatePath } from "next/cache";
import { cache } from "react";
import {
  getAppSettings,
  createAppSettings,
  updateAppSettings,
} from "@/lib/notion/settings";
import type { AppSettings } from "@/lib/notion/types";

export type { AppSettings };

// Env-var fallback (used when Notion Settings DB is not configured)
function getEnvSettings(): AppSettings {
  return {
    id: "env",
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    week_start_day: Number(process.env.WEEK_START_DAY ?? 1),
    deadline_surface_days: Number(process.env.DEADLINE_SURFACE_DAYS ?? 3),
  };
}

// Cached per-request to avoid multiple Notion fetches
export const getSettings = cache(async (): Promise<AppSettings> => {
  const notionSettings = await getAppSettings();
  return notionSettings ?? getEnvSettings();
});

export async function saveSettings(data: {
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
}) {
  try {
    const existing = await getAppSettings();
    if (existing) {
      await updateAppSettings(existing.id, data);
    } else {
      await createAppSettings(data);
    }
    revalidatePath("/settings");
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
