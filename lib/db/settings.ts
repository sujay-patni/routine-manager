import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { settings } from "./schema";
import type { AppSettings } from "../domain/types";

const DEFAULT_PROGRESS_UNITS = ["mins", "hrs"];

type SettingsRow = typeof settings.$inferSelect;

function normalizeProgressUnits(units: string[] | null | undefined): string[] {
  const result = [...DEFAULT_PROGRESS_UNITS];
  for (const unit of units ?? []) {
    const cleaned = unit.trim();
    if (cleaned && !result.includes(cleaned)) result.push(cleaned);
  }
  return result;
}

function rowToSettings(row: SettingsRow): AppSettings {
  return {
    id: row.id,
    timezone: row.timezone,
    week_start_day: row.weekStartDay,
    deadline_surface_days: row.deadlineSurfaceDays,
    day_start_hour: row.dayStartHour,
    progress_units: normalizeProgressUnits(row.progressUnits),
  };
}

export async function ensureProgressUnitsColumn(): Promise<void> {
  return;
}

export async function getAppSettings(): Promise<AppSettings | null> {
  const [row] = await getDb().select().from(settings).limit(1);
  return row ? rowToSettings(row) : null;
}

export async function createAppSettings(data: Omit<AppSettings, "id">): Promise<AppSettings> {
  const [row] = await getDb()
    .insert(settings)
    .values({
      id: "app",
      timezone: data.timezone,
      weekStartDay: data.week_start_day,
      deadlineSurfaceDays: data.deadline_surface_days,
      dayStartHour: data.day_start_hour,
      progressUnits: normalizeProgressUnits(data.progress_units),
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        timezone: data.timezone,
        weekStartDay: data.week_start_day,
        deadlineSurfaceDays: data.deadline_surface_days,
        dayStartHour: data.day_start_hour,
        progressUnits: normalizeProgressUnits(data.progress_units),
      },
    })
    .returning();
  return rowToSettings(row);
}

export async function updateAppSettings(id: string, data: Partial<Omit<AppSettings, "id">>): Promise<void> {
  await getDb()
    .update(settings)
    .set({
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.week_start_day !== undefined ? { weekStartDay: data.week_start_day } : {}),
      ...(data.deadline_surface_days !== undefined ? { deadlineSurfaceDays: data.deadline_surface_days } : {}),
      ...(data.day_start_hour !== undefined ? { dayStartHour: data.day_start_hour } : {}),
      ...(data.progress_units !== undefined ? { progressUnits: normalizeProgressUnits(data.progress_units) } : {}),
    })
    .where(eq(settings.id, id));
}
