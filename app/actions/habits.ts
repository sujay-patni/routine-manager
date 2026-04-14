"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getAllHabits as notionGetAllHabits,
  getAllHabitsIncludingInactive,
  getCompletionsForWeek,
  createCompletion,
  findAndDeleteCompletion,
  findCompletion,
  updateCompletionProgress,
  createHabit as notionCreateHabit,
  updateHabit as notionUpdateHabit,
  deleteHabit as notionDeleteHabit,
} from "@/lib/notion/habits";
import {
  getWeekBoundaries,
  getWeekBoundariesForDate,
  formatDateForDB,
  processHabits,
  parseZonedOrLocal,
} from "@/lib/habit-logic";
import { getSettings } from "@/app/actions/settings";
import { toZonedTime } from "date-fns-tz";
import type { Habit, HabitFrequency } from "@/lib/notion/types";

export type { Habit };

export async function getTodayHabits(dateStr?: string) {
  const settings = await getSettings();
  const { timezone, week_start_day: weekStartDay } = settings;

  let targetDate: Date;
  let weekStart: Date;
  let weekEnd: Date;

  if (dateStr) {
    targetDate = parseZonedOrLocal(dateStr, timezone);
    const bounds = getWeekBoundariesForDate(targetDate, timezone, weekStartDay);
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
  } else {
    const bounds = getWeekBoundaries(timezone, weekStartDay);
    targetDate = bounds.today;
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
  }

  const todayStr = formatDateForDB(targetDate);
  const weekStartStr = formatDateForDB(weekStart);
  const weekEndStr = formatDateForDB(weekEnd);

  const [allHabits, completions] = await Promise.all([
    notionGetAllHabits(),
    getCompletionsForWeek(weekStartStr, weekEndStr),
  ]);

  // Only include habits that existed on or before the target date
  const habits = allHabits.filter((h) => {
    const createdInTz = toZonedTime(new Date(h.created_at), timezone);
    return formatDateForDB(createdInTz) <= todayStr;
  });

  const rawHabits = habits.map((h) => {
    const weekCompletions = completions.filter((c) => c.habit_id === h.id);
    const todayCompletions = weekCompletions.filter((c) => c.date === todayStr);

    // Progress calculations
    const today_progress =
      h.progress_metric != null
        ? todayCompletions.reduce((sum, c) => sum + (c.progress_value ?? 0), 0)
        : null;
    const week_progress =
      h.progress_metric != null
        ? weekCompletions.reduce((sum, c) => sum + (c.progress_value ?? 0), 0)
        : null;

    // completed_today: for progress habits, done when today_progress >= target
    const completed_today =
      h.progress_metric != null && h.progress_target != null
        ? today_progress != null && today_progress >= h.progress_target
          ? 1
          : 0
        : todayCompletions.length;

    return {
      ...h,
      completions_this_week: weekCompletions.length,
      completed_today,
      today_progress,
      week_progress,
      today_completion_id: todayCompletions[0]?.id ?? null,
      completions_by_date: weekCompletions.map((c) => c.date),
    };
  });

  const processed = processHabits(rawHabits, targetDate, weekEnd);

  return {
    habits: processed,
    today: todayStr,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    timezone,
  };
}

export async function completeHabit(habitId: string, date: string, habitName = "") {
  await createCompletion(habitId, date, habitName);
  revalidatePath("/today");
  revalidatePath("/weekly");
  return { success: true };
}

export async function uncompleteHabit(habitId: string, date: string) {
  await findAndDeleteCompletion(habitId, date);
  revalidatePath("/today");
  revalidatePath("/weekly");
  return { success: true };
}

export async function logHabitProgress(
  habitId: string,
  date: string,
  habitName: string,
  progressValue: number
) {
  try {
    // Find existing completion for today
    const existing = await findCompletion(habitId, date);
    if (existing) {
      await updateCompletionProgress(existing.id, progressValue);
    } else {
      await createCompletion(habitId, date, habitName, progressValue);
    }
    revalidatePath("/today");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function createHabit(data: {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  weekly_target?: number;
  color: string;
  icon: string;
  time_of_day?: string;
  exact_time?: string;
  specific_days?: string;
  progress_metric?: string;
  progress_target?: number;
  progress_start?: number;
}) {
  const hasProgress = data.progress_metric || data.progress_target != null;
  try {
    await notionCreateHabit({
      ...data,
      weekly_target:
        data.frequency === "weekly" ? (data.weekly_target ?? 3) : data.weekly_target,
    });
    revalidatePath("/today");
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    const msg = String(e);
    // If Notion rejects because progress columns don't exist yet, retry without them
    if (
      hasProgress &&
      (msg.includes("is not a property that exists") || msg.includes("not a property"))
    ) {
      try {
        await notionCreateHabit({
          ...data,
          weekly_target:
            data.frequency === "weekly" ? (data.weekly_target ?? 3) : data.weekly_target,
          progress_metric: undefined,
          progress_target: undefined,
          progress_start: undefined,
        });
        revalidatePath("/today");
        revalidatePath("/settings");
        return {
          success: true,
          warning:
            "Habit added, but progress tracking was skipped — your Notion Habits database is missing these columns: Progress Metric (text), Progress Target (number), Progress Start (number). Add them in Notion, then edit this habit to enable progress tracking.",
        };
      } catch (e2) {
        return { error: String(e2) };
      }
    }
    return { error: msg };
  }
}

export async function updateHabit(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    frequency: HabitFrequency;
    weekly_target: number;
    color: string;
    icon: string;
    is_active: boolean;
    time_of_day: string | null;
    exact_time: string | null;
    specific_days: string | null;
    progress_metric: string | null;
    progress_target: number | null;
    progress_start: number | null;
  }>
) {
  try {
    await notionUpdateHabit(id, data);
    revalidatePath("/today");
    revalidatePath("/settings");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getAllHabits(): Promise<Habit[]> {
  return getAllHabitsIncludingInactive();
}

export async function deleteHabit(id: string) {
  try {
    await notionDeleteHabit(id);
    revalidatePath("/today");
    revalidatePath("/settings");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getWeeklySummary() {
  const settings = await getSettings();
  const { timezone, week_start_day: weekStartDay } = settings;
  const { weekStart, weekEnd } = getWeekBoundaries(timezone, weekStartDay);
  const weekStartStr = formatDateForDB(weekStart);
  const weekEndStr = formatDateForDB(weekEnd);

  const [habits, completions] = await Promise.all([
    notionGetAllHabits(),
    getCompletionsForWeek(weekStartStr, weekEndStr),
  ]);

  const habitsWithCounts = habits.map((h) => ({
    ...h,
    completions_this_week: completions.filter((c) => c.habit_id === h.id).length,
    completed_today: 0,
    today_progress: null,
    week_progress: null,
    today_completion_id: null,
    completions_by_date: completions
      .filter((c) => c.habit_id === h.id)
      .map((c) => c.date),
  }));

  return {
    habits: habitsWithCounts,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
  };
}
