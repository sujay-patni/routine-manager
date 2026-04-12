"use server";

import { revalidatePath } from "next/cache";
import {
  getAllHabits as notionGetAllHabits,
  getCompletionsForWeek,
  createCompletion,
  findAndDeleteCompletion,
  createHabit as notionCreateHabit,
  updateHabit as notionUpdateHabit,
} from "@/lib/notion/habits";
import {
  getWeekBoundaries,
  formatDateForDB,
  processHabits,
} from "@/lib/habit-logic";
import type { Habit } from "@/lib/notion/types";

function getSettings() {
  return {
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    weekStartDay: Number(process.env.WEEK_START_DAY ?? 1),
  };
}

export async function getTodayHabits() {
  const { timezone, weekStartDay } = getSettings();
  const { weekStart, weekEnd, today } = getWeekBoundaries(timezone, weekStartDay);
  const todayStr = formatDateForDB(today);
  const weekStartStr = formatDateForDB(weekStart);
  const weekEndStr = formatDateForDB(weekEnd);

  const [habits, completions] = await Promise.all([
    notionGetAllHabits(),
    getCompletionsForWeek(weekStartStr, weekEndStr),
  ]);

  const rawHabits = habits.map((h) => ({
    ...h,
    completions_this_week: completions.filter((c) => c.habit_id === h.id).length,
    completed_today: completions.filter(
      (c) => c.habit_id === h.id && c.date === todayStr
    ).length,
  }));

  const processed = processHabits(rawHabits, today, weekEnd);

  return {
    habits: processed,
    today: todayStr,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    timezone,
  };
}

export async function completeHabit(habitId: string, date: string, habitName = "") {
  try {
    await createCompletion(habitId, date, habitName);
    revalidatePath("/today");
    revalidatePath("/weekly");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function uncompleteHabit(habitId: string, date: string) {
  try {
    await findAndDeleteCompletion(habitId, date);
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
  frequency: "daily" | "weekly";
  weekly_target?: number;
  color: string;
  icon: string;
}) {
  try {
    await notionCreateHabit({
      ...data,
      weekly_target: data.frequency === "weekly" ? (data.weekly_target ?? 3) : undefined,
    });
    revalidatePath("/today");
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateHabit(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    frequency: "daily" | "weekly";
    weekly_target: number;
    color: string;
    icon: string;
    is_active: boolean;
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
  return notionGetAllHabits();
}

export async function getWeeklySummary() {
  const { timezone, weekStartDay } = getSettings();
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
