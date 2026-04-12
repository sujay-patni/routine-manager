"use server";

import { revalidatePath } from "next/cache";
import {
  getAllEvents,
  createEvent as notionCreateEvent,
  completeEvent as notionCompleteEvent,
  deleteEvent as notionDeleteEvent,
  updateEvent as notionUpdateEvent,
} from "@/lib/notion/events";
import { getWeekBoundaries, formatDateForDB, getDeadlineState } from "@/lib/habit-logic";
import type { AppEvent } from "@/lib/notion/types";

export interface TodayEvent extends AppEvent {
  daysUntilDue?: number;
  isOverdue?: boolean;
}

function getSettings() {
  return {
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    defaultSurfaceDays: Number(process.env.DEADLINE_SURFACE_DAYS ?? 3),
  };
}

export async function getTodayEvents(): Promise<TodayEvent[]> {
  const { timezone, defaultSurfaceDays } = getSettings();
  const { today } = getWeekBoundaries(timezone);
  const todayStr = formatDateForDB(today);

  const allEvents = await getAllEvents();
  const todayEvents: TodayEvent[] = [];

  for (const event of allEvents) {
    if (event.event_type === "timed") {
      if (!event.start_time) continue;
      const eventDate = event.start_time.split("T")[0];
      if (eventDate === todayStr) todayEvents.push(event);
    } else if (event.event_type === "all_day") {
      if (event.due_date === todayStr) todayEvents.push(event);
    } else if (event.event_type === "deadline") {
      const surfaceDays = event.surface_days ?? defaultSurfaceDays;
      const { show, daysUntil, isOverdue } = getDeadlineState(
        event.due_date!,
        surfaceDays,
        timezone
      );
      if (show) {
        todayEvents.push({ ...event, daysUntilDue: daysUntil, isOverdue });
      }
    }
  }

  return todayEvents;
}

export async function getUpcomingEvents(): Promise<AppEvent[]> {
  return getAllEvents();
}

export async function createEvent(data: {
  title: string;
  description?: string;
  event_type: "timed" | "all_day" | "deadline";
  start_time?: string;
  end_time?: string;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  surface_days?: number;
}) {
  try {
    await notionCreateEvent(data);
    revalidatePath("/today");
    revalidatePath("/schedule");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function completeEvent(id: string) {
  try {
    await notionCompleteEvent(id);
    revalidatePath("/today");
    revalidatePath("/schedule");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteEvent(id: string) {
  try {
    await notionDeleteEvent(id);
    revalidatePath("/today");
    revalidatePath("/schedule");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateEvent(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    event_type: AppEvent["event_type"];
    start_time: string | null;
    end_time: string | null;
    due_date: string | null;
    is_recurring: boolean;
    recurrence_rule: string | null;
    surface_days: number;
  }>
) {
  try {
    await notionUpdateEvent(id, data);
    revalidatePath("/today");
    revalidatePath("/schedule");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
