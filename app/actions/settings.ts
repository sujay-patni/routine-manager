"use server";

export interface AppSettings {
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
}

export async function getSettings(): Promise<AppSettings> {
  return {
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    week_start_day: Number(process.env.WEEK_START_DAY ?? 1),
    deadline_surface_days: Number(process.env.DEADLINE_SURFACE_DAYS ?? 3),
  };
}
