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

export type HabitState = "done" | "satisfied" | "at_risk" | "urgent" | "pending" | "optional";

export interface HabitWithCounts {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  weekly_target: number | null;
  color: string;
  icon: string;
  completions_this_week: number;
  completed_today: number;
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

export function formatDateForDB(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function daysUntilWeekEnd(today: Date, weekEnd: Date): number {
  return differenceInDays(weekEnd, today) + 1; // inclusive of today
}

export function shouldShowHabit(
  habit: HabitWithCounts,
  today: Date,
  weekEnd: Date
): ProcessedHabit {
  const target = habit.frequency === "daily" ? 7 : (habit.weekly_target ?? 1);
  const completions = Number(habit.completions_this_week);
  const completedToday = Number(habit.completed_today);
  const daysLeft = daysUntilWeekEnd(today, weekEnd);
  const remaining = Math.max(0, target - completions);

  let state: HabitState;
  let show: boolean;

  if (completedToday > 0) {
    state = "done";
    show = true;
  } else if (completions >= target) {
    state = "satisfied";
    show = false;
  } else if (remaining > daysLeft) {
    state = "at_risk";
    show = true;
  } else if (habit.frequency === "daily") {
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

export function getDeadlineState(dueDateStr: string, surfaceDays: number, timezone: string): {
  show: boolean;
  daysUntil: number;
  isOverdue: boolean;
} {
  const now = toZonedTime(new Date(), timezone);
  const dueDate = parseISO(dueDateStr);
  const diff = differenceInDays(dueDate, now);

  return {
    show: diff <= surfaceDays,
    daysUntil: diff,
    isOverdue: diff < 0,
  };
}
