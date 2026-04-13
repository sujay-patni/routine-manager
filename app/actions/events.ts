"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getAllEvents,
  getAllEventsIncludingCompleted,
  createEvent as notionCreateEvent,
  completeEvent as notionCompleteEvent,
  updateEventProgress as notionUpdateEventProgress,
  deleteEvent as notionDeleteEvent,
  updateEvent as notionUpdateEvent,
} from "@/lib/notion/events";
import { getWeekBoundaries, formatDateForDB, getDeadlineState } from "@/lib/habit-logic";
import { getSettings } from "@/app/actions/settings";
import { parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { AppEvent } from "@/lib/notion/types";

export interface TodayEvent extends AppEvent {
  daysUntilDue?: number;
  isOverdue?: boolean;
}

export async function getTodayEvents(dateStr?: string): Promise<TodayEvent[]> {
  const settings = await getSettings();
  const { timezone, deadline_surface_days: defaultSurfaceDays } = settings;

  let targetDate: Date;
  if (dateStr) {
    targetDate = toZonedTime(parseISO(dateStr), timezone);
  } else {
    const { today } = getWeekBoundaries(timezone);
    targetDate = today;
  }
  const todayStr = formatDateForDB(targetDate);

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
        timezone,
        targetDate
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

export async function getAllEventsForCalendar(): Promise<AppEvent[]> {
  return getAllEventsIncludingCompleted();
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
  time_of_day?: string;
  due_time?: string;
  progress_metric?: string;
  progress_target?: number;
}) {
  try {
    await notionCreateEvent(data);
    revalidatePath("/today");
    revalidatePath("/schedule");
    revalidatePath("/calendar");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function completeEvent(id: string) {
  after(async () => {
    await notionCompleteEvent(id);
    revalidatePath("/today");
    revalidatePath("/schedule");
  });
  return { success: true };
}

export async function updateEventProgress(id: string, progressValue: number, autoComplete = false) {
  try {
    await notionUpdateEventProgress(id, progressValue);
    if (autoComplete) {
      await notionCompleteEvent(id);
    }
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
    revalidatePath("/calendar");
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
    time_of_day: string | null;
    due_time: string | null;
    progress_metric: string | null;
    progress_target: number | null;
    progress_value: number | null;
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
