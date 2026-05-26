import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { events } from "./schema";
import type { AppEvent, TimeOfDay } from "../domain/types";

type EventRow = typeof events.$inferSelect;

function durationFromRange(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60_000);
}

function rowToEvent(row: EventRow): AppEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    event_type: row.eventType,
    start_time: row.startTime,
    end_time: row.endTime,
    due_date: row.dueDate,
    is_recurring: row.isRecurring,
    recurrence_rule: row.recurrenceRule,
    surface_days: row.surfaceDays,
    is_completed: row.isCompleted,
    completed_dates: Array.isArray(row.completedDates) ? row.completedDates : [],
    time_of_day: row.timeOfDay,
    due_time: row.dueTime,
    group_id: row.groupId,
    duration_minutes: row.durationMinutes ?? durationFromRange(row.startTime, row.endTime),
    duration_actual: row.durationActual,
  };
}

async function getEvent(id: string): Promise<AppEvent | null> {
  const [row] = await getDb().select().from(events).where(eq(events.id, id)).limit(1);
  return row ? rowToEvent(row) : null;
}

export async function getAllEvents(): Promise<AppEvent[]> {
  const rows = await getDb()
    .select()
    .from(events)
    .where(eq(events.isCompleted, false))
    .orderBy(asc(events.dueDate), asc(events.startTime), asc(events.createdAt));
  return rows.map(rowToEvent);
}

export async function getAllEventsIncludingCompleted(): Promise<AppEvent[]> {
  const rows = await getDb().select().from(events).orderBy(asc(events.dueDate), asc(events.startTime), asc(events.createdAt));
  return rows.map(rowToEvent);
}

export async function createEvent(data: {
  title: string;
  description?: string;
  event_type: AppEvent["event_type"];
  start_time?: string;
  end_time?: string;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  surface_days?: number;
  time_of_day?: string;
  due_time?: string;
  duration_minutes?: number;
  group_id?: string | null;
}): Promise<AppEvent> {
  const [row] = await getDb()
    .insert(events)
    .values({
      id: randomUUID(),
      title: data.title,
      description: data.description ?? null,
      eventType: data.event_type,
      startTime: data.start_time ?? null,
      endTime: data.end_time ?? null,
      dueDate: data.due_date ?? null,
      isRecurring: data.is_recurring ?? false,
      recurrenceRule: data.recurrence_rule ?? null,
      surfaceDays: data.surface_days ?? 3,
      isCompleted: false,
      completedDates: [],
      timeOfDay: (data.time_of_day as TimeOfDay | undefined) ?? null,
      dueTime: data.due_time ?? null,
      durationMinutes: data.duration_minutes ?? null,
      groupId: data.group_id ?? null,
    })
    .returning();
  return rowToEvent(row);
}

export async function completeEvent(id: string): Promise<void> {
  await getDb().update(events).set({ isCompleted: true }).where(eq(events.id, id));
}

export async function setEventCompleted(id: string, isCompleted: boolean, durationActual?: number): Promise<void> {
  await getDb()
    .update(events)
    .set({
      isCompleted,
      ...(isCompleted && durationActual !== undefined ? { durationActual } : {}),
    })
    .where(eq(events.id, id));
}

export async function setEventCompletedDate(
  id: string,
  date: string,
  isCompleted: boolean,
  durationActual?: number
): Promise<void> {
  const event = await getEvent(id);
  if (!event) return;
  const current = event.completed_dates;
  const completedDates = isCompleted
    ? current.includes(date) ? current : [...current, date]
    : current.filter((d) => d !== date);

  await getDb()
    .update(events)
    .set({
      completedDates,
      ...(isCompleted && durationActual !== undefined ? { durationActual } : {}),
    })
    .where(eq(events.id, id));
}

export async function deleteEvent(id: string, excludeDate?: string): Promise<void> {
  const [baseId] = id.split("_");

  if (excludeDate) {
    const event = await getEvent(baseId);
    if (event?.recurrence_rule) {
      const cleanDate = excludeDate.replace(/-/g, "");
      const newExdate = `${cleanDate}T120000Z`;
      const newRule = event.recurrence_rule.includes("EXDATE:")
        ? event.recurrence_rule.replace(/EXDATE:(.*)/, `EXDATE:$1,${newExdate}`)
        : `${event.recurrence_rule}\nEXDATE:${newExdate}`;
      await getDb().update(events).set({ recurrenceRule: newRule }).where(eq(events.id, baseId));
      return;
    }
  }

  await getDb().delete(events).where(eq(events.id, baseId));
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
    duration_minutes: number | null;
    group_id: string | null;
  }>
): Promise<void> {
  await getDb()
    .update(events)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.event_type !== undefined ? { eventType: data.event_type } : {}),
      ...(data.start_time !== undefined ? { startTime: data.start_time } : {}),
      ...(data.end_time !== undefined ? { endTime: data.end_time } : {}),
      ...(data.due_date !== undefined ? { dueDate: data.due_date } : {}),
      ...(data.is_recurring !== undefined ? { isRecurring: data.is_recurring } : {}),
      ...(data.recurrence_rule !== undefined ? { recurrenceRule: data.recurrence_rule } : {}),
      ...(data.surface_days !== undefined ? { surfaceDays: data.surface_days } : {}),
      ...(data.time_of_day !== undefined ? { timeOfDay: data.time_of_day as TimeOfDay | null } : {}),
      ...(data.due_time !== undefined ? { dueTime: data.due_time } : {}),
      ...(data.duration_minutes !== undefined ? { durationMinutes: data.duration_minutes } : {}),
      ...(data.group_id !== undefined ? { groupId: data.group_id } : {}),
    })
    .where(eq(events.id, id));
}
