"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import {
  getAllHabits as notionGetAllHabits,
  getAllHabitsIncludingInactive,
  getCompletionsForWeek,
  getCompletionsForDate,
  createCompletion,
  findAndDeleteCompletion,
  findCompletion,
  updateCompletionProgress,
  createHabit as notionCreateHabit,
  updateHabit as notionUpdateHabit,
  deleteHabit as notionDeleteHabit,
  ensureHabitSortOrderColumn,
  ensureHabitDurationColumns,
} from "@/lib/notion/habits";
import {
  getWeekBoundaries,
  getWeekBoundariesForDate,
  formatDateForDB,
  isHabitScheduledForDay,
  processHabits,
  parseZonedOrLocal,
} from "@/lib/habit-logic";
import {
  createSkip,
  deleteSkip,
  getSkipsForWindow,
} from "@/lib/notion/skips";
import { getSettings } from "@/app/actions/settings";
import { getTodayEvents } from "@/app/actions/events";
import { toZonedTime } from "date-fns-tz";
import type { Habit, HabitFrequency, ProgressPeriod, SkipScope } from "@/lib/notion/types";

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

const cachedGetSkipsForWindow = unstable_cache(getSkipsForWindow, ["skips-window"], {
  tags: ["skips"],
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

function habitSkipScope(frequency: HabitFrequency): SkipScope {
  return frequency === "weekly" ? "week" : "day";
}

export async function getTodayHabits(dateStr?: string) {
  const settings = await getSettings();
  const { timezone, week_start_day: weekStartDay, day_start_hour: dayStartHour } = settings;

  let targetDate: Date;
  let weekStart: Date;
  let weekEnd: Date;
  let isLateNight = false;

  if (dateStr) {
    targetDate = parseZonedOrLocal(dateStr, timezone);
    const bounds = getWeekBoundariesForDate(targetDate, timezone, weekStartDay);
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
  } else {
    const bounds = getWeekBoundaries(timezone, weekStartDay, dayStartHour);
    targetDate = bounds.today;
    weekStart = bounds.weekStart;
    weekEnd = bounds.weekEnd;
    const realToday = formatDateForDB(toZonedTime(new Date(), timezone));
    isLateNight = formatDateForDB(targetDate) !== realToday;
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

  const [completions, skips] = await Promise.all([
    cachedGetCompletionsForWeek(fetchStart, weekEndStr),
    cachedGetSkipsForWindow(todayStr, weekStartStr, weekEndStr),
  ]);

  // Only include habits that existed on or before the target date
  const habits = allHabits.filter((h) => {
    const createdInTz = toZonedTime(new Date(h.created_at), timezone);
    return formatDateForDB(createdInTz) <= todayStr;
  });

  const rawHabits = habits.map((h) => {
    const skip = skips.find((s) =>
      s.item_type === "habit" &&
      s.item_id === h.id &&
      (
        (s.scope === "day" && s.date === todayStr) ||
        (s.scope === "week" && s.week_start === weekStartStr && s.week_end === weekEndStr)
      )
    );
    const skippedDatesForWeek = skips
      .filter((s) =>
        s.item_type === "habit" &&
        s.item_id === h.id &&
        (
          (s.scope === "day" && s.date != null && s.date >= weekStartStr && s.date <= weekEndStr) ||
          (s.scope === "week" && s.week_start === weekStartStr && s.week_end === weekEndStr)
        )
      )
      .flatMap((s) => {
        if (s.scope === "day") return s.date ? [s.date] : [];
        return [weekStartStr];
      });
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

    const completedDatesForWeek = (() => {
      if (h.progress_metric != null && h.progress_target != null && h.progress_period === "daily") {
        const byDay = new Map<string, number>();
        for (const c of weekCompletions) {
          byDay.set(c.date, (byDay.get(c.date) ?? 0) + (c.progress_value ?? 0));
        }
        return [...byDay.entries()].filter(([, v]) => v >= h.progress_target!).map(([d]) => d);
      }
      return weekCompletions.map((c) => c.date);
    })();

    // completed_today: for progress habits, done when period total >= target
    const completed_today =
      h.progress_metric != null && h.progress_target != null
        ? today_progress != null && today_progress >= h.progress_target
          ? 1
          : 0
        : todayCompletions.length;

    return {
      ...h,
      completions_this_week: completedDatesForWeek.length,
      completed_today,
      today_progress,
      today_contribution,
      week_progress,
      today_completion_id: todayCompletions[0]?.id ?? null,
      skip_id: skip?.id ?? null,
      is_skipped: !!skip,
      skip_scope: skip?.scope ?? null,
      completions_by_date: completedDatesForWeek,
      skipped_dates: h.frequency === "weekly"
        ? []
        : skippedDatesForWeek.filter((date) => isHabitScheduledForDay(h, parseZonedOrLocal(date, timezone))),
    };
  });

  const processed = processHabits(rawHabits, targetDate, weekEnd);

  // During late-night the user is still in their day — suppress the urgent
  // (orange border) state so undone earlier habits don't look alarming.
  const finalHabits = isLateNight
    ? processed.map((h) => h.state === "urgent" ? { ...h, state: "pending" as const } : h)
    : processed;

  return {
    habits: finalHabits,
    today: todayStr,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    timezone,
    isLateNight,
  };
}

export async function completeHabit(habitId: string, date: string, habitName = "", durationActual?: number) {
  await createCompletion(habitId, date, habitName, undefined, durationActual);
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

export async function skipHabit(data: {
  habitId: string;
  habitName: string;
  frequency: HabitFrequency;
  date: string;
  weekStart: string;
  weekEnd: string;
}) {
  try {
    const scope = habitSkipScope(data.frequency);
    const skip = await createSkip({
      item_type: "habit",
      item_id: data.habitId,
      item_title: data.habitName,
      scope,
      date: data.date,
      week_start: data.weekStart,
      week_end: data.weekEnd,
    });
    revalidateTag("skips", {});
    revalidatePath("/today");
    return { success: true, skip };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function unskipHabit(skipId: string) {
  try {
    await deleteSkip(skipId);
    revalidateTag("skips", {});
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function logHabitProgress(
  habitId: string,
  date: string,
  habitName: string,
  progressValue: number,
  durationActual?: number
) {
  try {
    const existing = await findCompletion(habitId, date);
    if (existing) {
      await updateCompletionProgress(existing.id, progressValue, durationActual);
    } else {
      await createCompletion(habitId, date, habitName, progressValue, durationActual);
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
  progress_conversion?: number;
  progress_conversion_base?: number;
  duration_minutes?: number;
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
    if (msg.includes("is not a property that exists") || msg.includes("not a property")) {
      try {
        await ensureHabitDurationColumns();
        await notionCreateHabit({
          ...data,
          weekly_target:
            data.frequency === "weekly" ? (data.weekly_target ?? 3) : data.weekly_target,
          ...(hasProgress ? {} : {
            progress_metric: undefined,
            progress_target: undefined,
            progress_start: undefined,
            progress_period: undefined,
            progress_conversion: undefined,
          }),
        });
        revalidateTag("habits", {});
        revalidatePath("/today");
        revalidatePath("/settings");
        return { success: true };
      } catch {
        if (hasProgress) {
          try {
            await notionCreateHabit({
              ...data,
              weekly_target:
                data.frequency === "weekly" ? (data.weekly_target ?? 3) : data.weekly_target,
              progress_metric: undefined,
              progress_target: undefined,
              progress_start: undefined,
              progress_period: undefined,
              progress_conversion: undefined,
              duration_minutes: undefined,
            });
            revalidateTag("habits", {});
            revalidatePath("/today");
            revalidatePath("/settings");
            return {
              success: true,
              warning:
                "Habit added, but progress tracking was skipped — your Notion Habits database is missing these columns: Progress Metric (text), Progress Target (number), Progress Start (number), Progress Period (select). Add them in Notion, then edit this habit to enable progress tracking.",
            };
          } catch (e3) {
            return { error: String(e3) };
          }
        }
        return { error: msg };
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
    progress_conversion: number | null;
    progress_conversion_base: number | null;
    duration_minutes: number | null;
    sort_order: number | null;
  }>
) {
  const hasNewFields =
    data.progress_metric !== undefined ||
    data.progress_target !== undefined ||
    data.progress_start !== undefined ||
    data.progress_period !== undefined ||
    data.progress_conversion !== undefined ||
    data.duration_minutes !== undefined;

  try {
    await notionUpdateHabit(id, data);
    revalidateTag("habits", {});
    revalidatePath("/today");
    revalidatePath("/settings");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    const msg = String(e);
    if (hasNewFields && (msg.includes("is not a property that exists") || msg.includes("not a property"))) {
      try {
        await ensureHabitDurationColumns();
        await notionUpdateHabit(id, data);
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

export interface DayLogHabitEntry {
  habit_id: string;
  habit_name: string;
  progress_metric: string | null;
  progress_value: number | null;
  duration_actual: number | null;
}

export interface DayLogEventEntry {
  event_id: string;
  event_title: string;
  duration_actual: number | null;
  duration_computed: number | null; // from start/end times
}

export interface DayLogResult {
  date: string;
  habitEntries: DayLogHabitEntry[];
  eventEntries: DayLogEventEntry[];
  totalTrackedMinutes: number;
}

export async function getDayLog(dateStr: string): Promise<DayLogResult> {
  const settings = await getSettings();
  const { timezone } = settings;

  // Resolve effective date (handles late-night: dateStr is already the effective date)
  const targetDate = parseZonedOrLocal(dateStr, timezone);
  const todayStr = formatDateForDB(targetDate);

  const [completions, habits, todayEvents] = await Promise.all([
    getCompletionsForDate(todayStr),
    cachedGetAllHabits(),
    getTodayEvents(dateStr),
  ]);

  const habitMap = new Map(habits.map(h => [h.id, h]));
  const grouped = new Map<string, { progress_value: number; duration_actual: number | null }>();

  for (const c of completions) {
    const existing = grouped.get(c.habit_id);
    if (existing) {
      existing.progress_value += c.progress_value ?? 0;
      if (c.duration_actual != null) {
        existing.duration_actual = (existing.duration_actual ?? 0) + c.duration_actual;
      }
    } else {
      grouped.set(c.habit_id, {
        progress_value: c.progress_value ?? 0,
        duration_actual: c.duration_actual ?? null,
      });
    }
  }

  const habitEntries: DayLogHabitEntry[] = [];
  let totalTrackedMinutes = 0;

  for (const [habitId, agg] of grouped) {
    const habit = habitMap.get(habitId);
    const durationMins = agg.duration_actual ?? null;
    habitEntries.push({
      habit_id: habitId,
      habit_name: habit?.name ?? habitId,
      progress_metric: habit?.progress_metric ?? null,
      progress_value: habit?.progress_metric ? agg.progress_value : null,
      duration_actual: durationMins,
    });
    if (durationMins != null) totalTrackedMinutes += durationMins;
  }

  const eventEntries: DayLogEventEntry[] = [];
  for (const e of todayEvents) {
    if (!e.is_completed) continue;
    let durationComputed: number | null = null;
    if (e.start_time && e.end_time) {
      const diff = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
      if (diff > 0) durationComputed = Math.round(diff);
    }
    const mins = e.duration_actual ?? durationComputed;
    eventEntries.push({
      event_id: e.id,
      event_title: e.title,
      duration_actual: e.duration_actual ?? null,
      duration_computed: durationComputed,
    });
    if (mins != null) totalTrackedMinutes += mins;
  }

  return { date: todayStr, habitEntries, eventEntries, totalTrackedMinutes };
}
