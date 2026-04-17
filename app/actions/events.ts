"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getAllEvents,
  getAllEventsIncludingCompleted,
  createEvent as notionCreateEvent,
  completeEvent as notionCompleteEvent,
  setEventCompleted as notionSetEventCompleted,
  deleteEvent as notionDeleteEvent,
  updateEvent as notionUpdateEvent,
} from "@/lib/notion/events";
import { getWeekBoundaries, formatDateForDB, getDeadlineState, parseZonedOrLocal } from "@/lib/habit-logic";
import { getSettings } from "@/app/actions/settings";
import { toZonedTime } from "date-fns-tz";
import type { AppEvent } from "@/lib/notion/types";

export interface TodayEvent extends AppEvent {
  daysUntilDue?: number;
  isOverdue?: boolean;
}

import { rrulestr } from "rrule";

function getRecurrenceInstance(event: AppEvent, targetDate: Date, timezone: string, todayStr: string): Date | null {
  if (!event.is_recurring || !event.recurrence_rule) return null;
  try {
    const baseStr = event.event_type === "timed" ? event.start_time : event.due_date;
    if (!baseStr) return null;
    let dtstart = baseStr.replace(/[-:]/g, "");
    if (dtstart.includes(".")) dtstart = dtstart.split(".")[0] + "Z";
    if (!dtstart.includes("T")) dtstart += "T120000Z";
    const ruleStr = `DTSTART:${dtstart}\nRRULE:${event.recurrence_rule}`;
    const rule = rrulestr(ruleStr);
    const probeStart = new Date(targetDate.getTime() - 48 * 3600 * 1000);
    const probeEnd = new Date(targetDate.getTime() + 48 * 3600 * 1000);
    const instances = rule.between(probeStart, probeEnd, true);
    for (const inst of instances) {
      if (formatDateForDB(toZonedTime(inst, timezone)) === todayStr) return inst;
    }
  } catch (e) {
    console.error("Failed to parse RRule:", e);
  }
  return null;
}

export async function getTodayEvents(dateStr?: string): Promise<TodayEvent[]> {
  const settings = await getSettings();
  const { timezone, deadline_surface_days: defaultSurfaceDays } = settings;

  let targetDate: Date;
  if (dateStr) {
    targetDate = parseZonedOrLocal(dateStr, timezone);
  } else {
    const { today } = getWeekBoundaries(timezone);
    targetDate = today;
  }
  const todayStr = formatDateForDB(targetDate);

  let allEvents: AppEvent[];
  try {
    allEvents = await getAllEventsIncludingCompleted();
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("Could not find database") || msg.includes("not shared")) {
      console.error("Events DB inaccessible:", msg);
      return [];
    }
    throw e;
  }
  const todayEvents: TodayEvent[] = [];

  for (const event of allEvents) {
    if (event.event_type === "timed") {
      if (!event.start_time) continue;
      if (event.is_recurring) {
        const inst = getRecurrenceInstance(event, targetDate, timezone, todayStr);
        if (inst) {
          let newEnd = event.end_time;
          if (event.start_time && event.end_time) {
            const durMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
            newEnd = new Date(inst.getTime() + durMs).toISOString();
          }
          todayEvents.push({ ...event, id: `${event.id}_${todayStr}`, start_time: inst.toISOString(), end_time: newEnd });
        }
      } else {
        const eventDate = formatDateForDB(parseZonedOrLocal(event.start_time, timezone));
        if (eventDate === todayStr) todayEvents.push(event);
      }
    } else if (event.event_type === "all_day") {
      if (event.is_recurring) {
        const inst = getRecurrenceInstance(event, targetDate, timezone, todayStr);
        if (inst) {
           todayEvents.push({ ...event, id: `${event.id}_${todayStr}`, due_date: todayStr });
        }
      } else {
        if (event.due_date === todayStr) todayEvents.push(event);
      }
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
  const settings = await getSettings();
  const { timezone } = settings;

  const allEvents = await getAllEventsIncludingCompleted();
  const result: AppEvent[] = [];

  // Expand from 3 months ago to 6 months from now
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 6);
  rangeEnd.setHours(23, 59, 59, 999);

  for (const event of allEvents) {
    if (!event.is_recurring || !event.recurrence_rule) {
      result.push(event);
      continue;
    }

    try {
      const baseStr = event.event_type === "timed" ? event.start_time : event.due_date;
      if (!baseStr) { result.push(event); continue; }

      let dtstart = baseStr.replace(/[-:]/g, "");
      if (dtstart.includes(".")) dtstart = dtstart.split(".")[0] + "Z";
      if (!dtstart.includes("T")) dtstart += "T120000Z";

      const ruleStr = `DTSTART:${dtstart}\nRRULE:${event.recurrence_rule}`;
      const rule = rrulestr(ruleStr);
      const instances = rule.between(rangeStart, rangeEnd, true);

      for (const inst of instances) {
        const instanceDateStr = formatDateForDB(toZonedTime(inst, timezone));

        if (event.event_type === "timed") {
          let newEnd = event.end_time;
          if (event.start_time && event.end_time) {
            const durMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
            newEnd = new Date(inst.getTime() + durMs).toISOString();
          }
          result.push({
            ...event,
            id: `${event.id}_${instanceDateStr}`,
            start_time: inst.toISOString(),
            end_time: newEnd,
          });
        } else if (event.event_type === "all_day") {
          result.push({
            ...event,
            id: `${event.id}_${instanceDateStr}`,
            due_date: instanceDateStr,
          });
        }
      }
    } catch (e) {
      console.error("Failed to expand RRule for calendar:", e);
      result.push(event); // fallback: show original
    }
  }

  return result;
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
    revalidatePath("/calendar");
  });
  return { success: true };
}

export async function setEventCompleted(id: string, isCompleted: boolean) {
  try {
    await notionSetEventCompleted(id, isCompleted);
    revalidatePath("/today");
    revalidatePath("/schedule");
    revalidatePath("/calendar");
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteEvent(id: string, excludeDate?: string) {
  try {
    await notionDeleteEvent(id, excludeDate);
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
