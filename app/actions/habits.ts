"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
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
  ensureHabitSortOrderColumn,
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
import type { Habit, HabitFrequency, ProgressPeriod } from "@/lib/notion/types";

export type { Habit };

const cachedGetAllHabits = unstable_cache(notionGetAllHabits, ["habits-active"], {
  tags: ["habits"],
  revalidate: 300,
});

const cachedGetAllHabitsIncludingInactive = unstable_cache(getAllHabitsIncludingInactive, ["habits-all"], {
  tags: ["habits"],
  revalidate: 300,
});

const cachedGetCompletionsForWeek = unstable_cache(getCompletionsForWeek, ["completions"], {
  tags: ["completions"],
  revalidate: 60,
});

/** Returns the period start date string (YYYY-MM-DD) for a given progress period. */
function getPeriodStart(
  period: ProgressPeriod | null,
  todayStr: string,
  weekStartStr: string
): string {
  switch (period) {
    case "weekly":
      return weekStartStr;
    case "monthly": {
      // e.g. "2026-04-16" → "2026-04-01"
      return todayStr.slice(0, 7) + "-01";
    }
    case "yearly": {
      return todayStr.slice(0, 4) + "-01-01";
    }
    default:
      return todayStr; // "daily" — just today
  }
}

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

  // First fetch habits to know what periods we need
  const allHabits = await cachedGetAllHabits();

  // Determine widest period needed for completions fetch
  const hasMonthly = allHabits.some(
    (h) => h.progress_metric && h.progress_period === "monthly"
  );
  const hasYearly = allHabits.some(
    (h) => h.progress_metric && h.progress_period === "yearly"
  );

  let fetchStart = weekStartStr;
  if (hasYearly) {
    fetchStart = todayStr.slice(0, 4) + "-01-01";
  } else if (hasMonthly) {
    fetchStart = todayStr.slice(0, 7) + "-01";
  }

  const completions = await cachedGetCompletionsForWeek(fetchStart, weekEndStr);

  // Only include habits that existed on or before the target date
  const habits = allHabits.filter((h) => {
    const createdInTz = toZonedTime(new Date(h.created_at), timezone);
    return formatDateForDB(createdInTz) <= todayStr;
  });

  const rawHabits = habits.map((h) => {
    // All completions for this habit in the fetched range
    const allHabitCompletions = completions.filter((c) => c.habit_id === h.id);
    // Week completions (for weekly target tracking)
    const weekCompletions = allHabitCompletions.filter(
      (c) => c.date >= weekStartStr && c.date <= weekEndStr
    );
    // Today completions
    const todayCompletions = allHabitCompletions.filter((c) => c.date === todayStr);

    // Period-based progress total (for display + done check)
    const periodStart = getPeriodStart(h.progress_period, todayStr, weekStartStr);
    const periodCompletions = allHabitCompletions.filter(
      (c) => c.date >= periodStart && c.date <= todayStr
    );

    const today_progress =
      h.progress_metric != null
        ? periodCompletions.reduce((sum, c) => sum + (c.progress_value ?? 0), 0)
        : null;

    // Today's individual contribution (for the inline editor)
    const today_contribution =
      h.progress_metric != null
        ? todayCompletions.reduce((sum, c) => sum + (c.progress_value ?? 0), 0)
        : null;

    const week_progress =
      h.progress_metric != null
        ? weekCompletions.reduce((sum, c) => sum + (c.progress_value ?? 0), 0)
        : null;

    // completed_today: for progress habits, done when period total >= target
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
      today_contribution,
      week_progress,
      today_completion_id: todayCompletions[0]?.id ?? null,
      completions_by_date: (() => {
        if (h.progress_metric != null && h.progress_target != null && h.progress_period === "daily") {
          const byDay = new Map<string, number>();
          for (const c of weekCompletions) {
            byDay.set(c.date, (byDay.get(c.date) ?? 0) + (c.progress_value ?? 0));
          }
          return [...byDay.entries()].filter(([, v]) => v >= h.progress_target!).map(([d]) => d);
        }
        return weekCompletions.map((c) => c.date);
      })(),
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
  revalidateTag("completions", {});
  revalidatePath("/today");
  revalidatePath("/weekly");
  return { success: true };
}

export async function uncompleteHabit(habitId: string, date: string) {
  await findAndDeleteCompletion(habitId, date);
  revalidateTag("completions", {});
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
    const existing = await findCompletion(habitId, date);
    if (existing) {
      await updateCompletionProgress(existing.id, progressValue);
    } else {
      await createCompletion(habitId, date, habitName, progressValue);
    }
    revalidateTag("completions", {});
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
  time_of_day?: string;
  exact_time?: string;
  specific_days?: string;
  progress_metric?: string;
  progress_target?: number;
  progress_start?: number;
  progress_period?: string;
}) {
  const hasProgress = data.progress_metric || data.progress_target != null;
  try {
    await notionCreateHabit({
      ...data,
      weekly_target:
        data.frequency === "weekly" ? (data.weekly_target ?? 3) : data.weekly_target,
    });
    revalidateTag("habits", {});
    revalidatePath("/today");
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    const msg = String(e);
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
          progress_period: undefined,
        });
        revalidateTag("habits", {});
        revalidatePath("/today");
        revalidatePath("/settings");
        return {
          success: true,
          warning:
            "Habit added, but progress tracking was skipped — your Notion Habits database is missing these columns: Progress Metric (text), Progress Target (number), Progress Start (number), Progress Period (select). Add them in Notion, then edit this habit to enable progress tracking.",
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
    description: string | null;
    frequency: HabitFrequency;
    weekly_target: number | null;
    is_active: boolean;
    time_of_day: string | null;
    exact_time: string | null;
    specific_days: string | null;
    progress_metric: string | null;
    progress_target: number | null;
    progress_start: number | null;
    progress_period: string | null;
    sort_order: number | null;
  }>
) {
  const hasProgressFields =
    data.progress_metric !== undefined ||
    data.progress_target !== undefined ||
    data.progress_start !== undefined ||
    data.progress_period !== undefined;

  try {
    await notionUpdateHabit(id, data);
    revalidateTag("habits", {});
    revalidatePath("/today");
    revalidatePath("/settings");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    const msg = String(e);
    if (hasProgressFields && (msg.includes("is not a property that exists") || msg.includes("not a property"))) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { progress_metric, progress_target, progress_start, progress_period, ...safeData } = data;
        await notionUpdateHabit(id, safeData);
        revalidateTag("habits", {});
        revalidatePath("/today");
        revalidatePath("/settings");
        revalidatePath("/weekly");
        return { success: true };
      } catch (e2) {
        return { error: String(e2) };
      }
    }
    return { error: msg };
  }
}

/** Reorders habits by writing sort_order = index * 10 for each id in the array. */
export async function reorderHabits(habitIds: string[]) {
  const doReorder = () =>
    Promise.all(habitIds.map((id, index) => notionUpdateHabit(id, { sort_order: index * 10 })));

  try {
    await doReorder();
    revalidateTag("habits", {});
    revalidatePath("/today");
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    const msg = String(e);
    if (msg.includes("is not a property that exists") || msg.includes("not a property")) {
      try {
        await ensureHabitSortOrderColumn();
        await doReorder();
        revalidateTag("habits", {});
        revalidatePath("/today");
        revalidatePath("/settings");
        return { success: true };
      } catch (e2) {
        return { error: String(e2) };
      }
    }
    return { error: msg };
  }
}

export async function getAllHabits(): Promise<Habit[]> {
  return cachedGetAllHabitsIncludingInactive();
}

export async function deleteHabit(id: string) {
  try {
    await notionDeleteHabit(id);
    revalidateTag("habits", {});
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
    today_contribution: null,
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
