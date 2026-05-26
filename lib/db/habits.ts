import { randomUUID } from "crypto";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "./client";
import { completions, habits } from "./schema";
import type {
  Completion,
  Habit,
  HabitFrequency,
  HealthSource,
  ProgressPeriod,
  TimeOfDay,
} from "../domain/types";

type HabitRow = typeof habits.$inferSelect;
type CompletionRow = typeof completions.$inferSelect;

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    weekly_target: row.weeklyTarget,
    color: row.color,
    icon: row.icon,
    is_active: row.isActive,
    created_at: row.createdAt,
    time_of_day: row.timeOfDay,
    exact_time: row.exactTime,
    specific_days: row.specificDays,
    progress_metric: row.progressMetric,
    progress_target: row.progressTarget,
    progress_start: row.progressStart,
    progress_period: row.progressPeriod,
    progress_conversion: row.progressConversion,
    progress_conversion_base: row.progressConversionBase,
    duration_minutes: row.durationMinutes,
    sort_order: row.sortOrder,
    group_id: row.groupId,
    health_source: row.healthSource,
  };
}

function rowToCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    habit_id: row.habitId,
    date: row.date,
    note: row.note,
    progress_value: row.progressValue,
    duration_actual: row.durationActual,
  };
}

function sortHabits(rows: HabitRow[]): HabitRow[] {
  return [...rows].sort((a, b) => {
    const orderA = a.sortOrder ?? 9999;
    const orderB = b.sortOrder ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function getAllHabits(): Promise<Habit[]> {
  const rows = await getDb()
    .select()
    .from(habits)
    .where(eq(habits.isActive, true))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));
  return sortHabits(rows).map(rowToHabit);
}

export async function getAllHabitsIncludingInactive(): Promise<Habit[]> {
  const rows = await getDb().select().from(habits).orderBy(asc(habits.sortOrder), asc(habits.createdAt));
  return sortHabits(rows).map(rowToHabit);
}

export async function getCompletionsForWeek(weekStart: string, weekEnd: string): Promise<Completion[]> {
  const rows = await getDb()
    .select()
    .from(completions)
    .where(and(gte(completions.date, weekStart), lte(completions.date, weekEnd)));
  return rows.map(rowToCompletion);
}

export async function getCompletionsForDate(date: string): Promise<Completion[]> {
  const rows = await getDb().select().from(completions).where(eq(completions.date, date));
  return rows.map(rowToCompletion);
}

export async function ensureHabitSortOrderColumn(): Promise<void> {
  return;
}

export async function ensureHabitDurationColumns(): Promise<void> {
  return;
}

export async function createCompletion(
  habitId: string,
  date: string,
  _habitName: string,
  progressValue?: number,
  durationActual?: number
): Promise<Completion> {
  const existing = await findCompletion(habitId, date);
  if (existing) return existing;

  try {
    const [row] = await getDb()
      .insert(completions)
      .values({
        id: randomUUID(),
        habitId,
        date,
        progressValue: progressValue ?? null,
        durationActual: durationActual ?? null,
      })
      .returning();
    return rowToCompletion(row);
  } catch (e) {
    const retry = await findCompletion(habitId, date);
    if (retry) return retry;
    throw e;
  }
}

export async function deleteCompletion(completionId: string): Promise<void> {
  await getDb().delete(completions).where(eq(completions.id, completionId));
}

export async function findCompletion(habitId: string, date: string): Promise<Completion | null> {
  const [row] = await getDb()
    .select()
    .from(completions)
    .where(and(eq(completions.habitId, habitId), eq(completions.date, date)))
    .limit(1);
  return row ? rowToCompletion(row) : null;
}

export async function updateCompletionProgress(
  completionId: string,
  progressValue: number,
  durationActual?: number
): Promise<void> {
  await getDb()
    .update(completions)
    .set({
      progressValue,
      ...(durationActual !== undefined ? { durationActual } : {}),
    })
    .where(eq(completions.id, completionId));
}

export async function upsertCompletion(
  habitId: string,
  date: string,
  habitName: string,
  progressValue: number,
  durationActual?: number
): Promise<{ created: boolean; id: string }> {
  const existing = await findCompletion(habitId, date);
  if (existing) {
    await updateCompletionProgress(existing.id, progressValue, durationActual);
    return { created: false, id: existing.id };
  }
  const created = await createCompletion(habitId, date, habitName, progressValue, durationActual);
  return { created: true, id: created.id };
}

export async function findAndDeleteCompletion(habitId: string, date: string): Promise<void> {
  await getDb()
    .delete(completions)
    .where(and(eq(completions.habitId, habitId), eq(completions.date, date)));
}

export async function createHabit(data: {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  weekly_target?: number;
  color?: string;
  icon?: string;
  time_of_day?: string;
  exact_time?: string;
  specific_days?: string;
  progress_metric?: string;
  progress_target?: number;
  progress_start?: number;
  progress_period?: string;
  progress_conversion?: number;
  progress_conversion_base?: number;
  duration_minutes?: number;
  sort_order?: number;
  group_id?: string | null;
  health_source?: HealthSource | null;
}): Promise<Habit> {
  const [row] = await getDb()
    .insert(habits)
    .values({
      id: randomUUID(),
      name: data.name,
      description: data.description ?? null,
      frequency: data.frequency,
      weeklyTarget: data.weekly_target ?? null,
      color: data.color ?? "#6366f1",
      icon: data.icon ?? "",
      isActive: true,
      timeOfDay: (data.time_of_day as TimeOfDay | undefined) ?? null,
      exactTime: data.exact_time ?? null,
      specificDays: data.specific_days ?? null,
      progressMetric: data.progress_metric ?? null,
      progressTarget: data.progress_target ?? null,
      progressStart: data.progress_start ?? null,
      progressPeriod: (data.progress_period as ProgressPeriod | undefined) ?? null,
      progressConversion: data.progress_conversion ?? null,
      progressConversionBase: data.progress_conversion_base ?? null,
      durationMinutes: data.duration_minutes ?? null,
      sortOrder: data.sort_order ?? null,
      groupId: data.group_id ?? null,
      healthSource: data.health_source ?? null,
    })
    .returning();
  return rowToHabit(row);
}

export async function deleteHabit(id: string): Promise<void> {
  await getDb().delete(habits).where(eq(habits.id, id));
}

export async function updateHabit(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    frequency: HabitFrequency;
    weekly_target: number | null;
    color: string;
    icon: string;
    is_active: boolean;
    time_of_day: string | null;
    exact_time: string | null;
    specific_days: string | null;
    progress_metric: string | null;
    progress_target: number | null;
    progress_start: number | null;
    progress_period: string | null;
    progress_conversion: number | null;
    progress_conversion_base: number | null;
    duration_minutes: number | null;
    sort_order: number | null;
    group_id: string | null;
    health_source: HealthSource | null;
  }>
): Promise<void> {
  await getDb()
    .update(habits)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.weekly_target !== undefined ? { weeklyTarget: data.weekly_target } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.is_active !== undefined ? { isActive: data.is_active } : {}),
      ...(data.time_of_day !== undefined ? { timeOfDay: data.time_of_day as TimeOfDay | null } : {}),
      ...(data.exact_time !== undefined ? { exactTime: data.exact_time } : {}),
      ...(data.specific_days !== undefined ? { specificDays: data.specific_days } : {}),
      ...(data.progress_metric !== undefined ? { progressMetric: data.progress_metric } : {}),
      ...(data.progress_target !== undefined ? { progressTarget: data.progress_target } : {}),
      ...(data.progress_start !== undefined ? { progressStart: data.progress_start } : {}),
      ...(data.progress_period !== undefined ? { progressPeriod: data.progress_period as ProgressPeriod | null } : {}),
      ...(data.progress_conversion !== undefined ? { progressConversion: data.progress_conversion } : {}),
      ...(data.progress_conversion_base !== undefined ? { progressConversionBase: data.progress_conversion_base } : {}),
      ...(data.duration_minutes !== undefined ? { durationMinutes: data.duration_minutes } : {}),
      ...(data.sort_order !== undefined ? { sortOrder: data.sort_order } : {}),
      ...(data.group_id !== undefined ? { groupId: data.group_id } : {}),
      ...(data.health_source !== undefined ? { healthSource: data.health_source } : {}),
    })
    .where(eq(habits.id, id));
}
