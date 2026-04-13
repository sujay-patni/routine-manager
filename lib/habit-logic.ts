import {
  startOfISOWeek,
  endOfISOWeek,
  startOfWeek,
  endOfWeek,
  differenceInDays,
  parseISO,
  format,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Habit } from "./notion/types";

export type HabitState = "done" | "satisfied" | "at_risk" | "urgent" | "pending" | "optional";

// Day abbreviations indexed by getDay() (0=Sun, 1=Mon, ..., 6=Sat)
const DAY_ABBREVS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export interface HabitWithCounts extends Habit {
  completions_this_week: number;
  completed_today: number;
  today_progress: number | null;
  week_progress: number | null;
  today_completion_id: string | null;
}

export interface ProcessedHabit extends HabitWithCounts {
  state: HabitState;
  show: boolean;
  target: number;
  remaining: number;
  daysLeftInWeek: number;
}

export function getWeekBoundaries(
  timezone: string,
  weekStartDay: number = 1
): { weekStart: Date; weekEnd: Date; today: Date } {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);

  const weekStart =
    weekStartDay === 1
      ? startOfISOWeek(zonedNow)
      : startOfWeek(zonedNow, { weekStartsOn: 0 });

  const weekEnd =
    weekStartDay === 1
      ? endOfISOWeek(zonedNow)
      : endOfWeek(zonedNow, { weekStartsOn: 0 });

  return { weekStart, weekEnd, today: zonedNow };
}

export function getWeekBoundariesForDate(
  date: Date,
  timezone: string,
  weekStartDay: number = 1
): { weekStart: Date; weekEnd: Date } {
  const zonedDate = toZonedTime(date, timezone);

  const weekStart =
    weekStartDay === 1
      ? startOfISOWeek(zonedDate)
      : startOfWeek(zonedDate, { weekStartsOn: 0 });

  const weekEnd =
    weekStartDay === 1
      ? endOfISOWeek(zonedDate)
      : endOfWeek(zonedDate, { weekStartsOn: 0 });

  return { weekStart, weekEnd };
}

export function formatDateForDB(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function daysUntilWeekEnd(today: Date, weekEnd: Date): number {
  return differenceInDays(weekEnd, today) + 1; // inclusive of today
}

/** Returns whether this habit should be done on the given day. */
function isHabitScheduledForDay(habit: Habit, day: Date): boolean {
  switch (habit.frequency) {
    case "daily":
      return true;

    case "weekly":
      // Weekly habits can be done any day until target is met
      return true;

    case "specific_days_weekly": {
      if (!habit.specific_days) return true;
      const todayAbbr = DAY_ABBREVS[day.getDay()];
      const days = habit.specific_days.split(",").map((d) => d.trim().toUpperCase());
      return days.includes(todayAbbr);
    }

    case "specific_dates_monthly": {
      if (!habit.specific_days) return true;
      const todayDate = day.getDate();
      const dates = habit.specific_days.split(",").map((d) => parseInt(d.trim(), 10));
      return dates.includes(todayDate);
    }

    case "specific_dates_yearly": {
      if (!habit.specific_days) return true;
      // Format: "MM-DD"
      const mmdd = `${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      return habit.specific_days.trim() === mmdd;
    }

    default:
      return true;
  }
}

/** Weekly target derived from frequency + specific_days + weekly_target */
function getHabitWeeklyTarget(habit: Habit): number {
  switch (habit.frequency) {
    case "daily":
      return 7;
    case "weekly":
      return habit.weekly_target ?? 1;
    case "specific_days_weekly":
      return habit.specific_days ? habit.specific_days.split(",").length : 1;
    case "specific_dates_monthly":
    case "specific_dates_yearly":
      // These recur less frequently; treat as 1 per occurrence
      return 1;
    default:
      return 7;
  }
}

export function shouldShowHabit(
  habit: HabitWithCounts,
  today: Date,
  weekEnd: Date
): ProcessedHabit {
  const target = getHabitWeeklyTarget(habit);
  const scheduledToday = isHabitScheduledForDay(habit, today);
  const completions = Number(habit.completions_this_week);
  const completedToday = Number(habit.completed_today);
  const daysLeft = daysUntilWeekEnd(today, weekEnd);
  const remaining = Math.max(0, target - completions);

  // If the habit has a progress target, check progress-based completion
  const isProgressDone =
    habit.progress_metric &&
    habit.progress_target != null &&
    habit.today_progress != null &&
    habit.today_progress >= habit.progress_target;

  const effectiveCompletedToday = isProgressDone ? 1 : completedToday;

  let state: HabitState;
  let show: boolean;

  // Habits not scheduled for today are hidden (except if at_risk)
  if (!scheduledToday) {
    // For specific-schedule habits: show at_risk if falling behind weekly target
    if (remaining > daysLeft) {
      state = "at_risk";
      show = true;
    } else {
      state = "optional";
      show = false;
    }
    return { ...habit, state, show, target, remaining, daysLeftInWeek: daysLeft };
  }

  if (effectiveCompletedToday > 0) {
    state = "done";
    show = true;
  } else if (completions >= target) {
    state = "satisfied";
    show = false;
  } else if (remaining > daysLeft) {
    state = "at_risk";
    show = true;
  } else if (habit.frequency === "daily" || habit.frequency === "specific_days_weekly" || habit.frequency === "specific_dates_monthly" || habit.frequency === "specific_dates_yearly") {
    state = "pending";
    show = true;
  } else if (remaining >= daysLeft) {
    state = "urgent";
    show = true;
  } else {
    state = "optional";
    show = false;
  }

  return { ...habit, state, show, target, remaining, daysLeftInWeek: daysLeft };
}

export function processHabits(
  habits: HabitWithCounts[],
  today: Date,
  weekEnd: Date
): ProcessedHabit[] {
  return habits.map((h) => shouldShowHabit(h, today, weekEnd));
}

export function getDeadlineState(
  dueDateStr: string,
  surfaceDays: number,
  timezone: string,
  referenceDate?: Date
): {
  show: boolean;
  daysUntil: number;
  isOverdue: boolean;
} {
  const ref = referenceDate ?? toZonedTime(new Date(), timezone);
  const dueDate = parseISO(dueDateStr);
  const diff = differenceInDays(dueDate, ref);

  return {
    show: diff <= surfaceDays,
    daysUntil: diff,
    isOverdue: diff < 0,
  };
}
