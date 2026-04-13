import { notion, EVENTS_DB } from "./client";
import { getText, getSelect, getCheckbox, getDate } from "./helpers";
import type { AppEvent, TimeOfDay } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function pageToEvent(page: any): AppEvent {
  const props = page.properties;
  return {
    id: page.id,
    title: getText(props["Title"]),
    description: getText(props["Description"]) || null,
    event_type: (getSelect(props["Type"]) as AppEvent["event_type"]) || "all_day",
    start_time: props["Start Time"]?.date?.start ?? null,
    end_time: props["End Time"]?.date?.start ?? null,
    due_date: getDate(props["Due Date"]) || null,
    is_recurring: getCheckbox(props["Recurring"]),
    recurrence_rule: getText(props["Recurrence Rule"]) || null,
    surface_days: props["Surface Days"]?.number ?? 3,
    is_completed: getCheckbox(props["Completed"]),
    time_of_day: (getSelect(props["Time of Day"]) as TimeOfDay) || null,
    due_time: getText(props["Due Time"]) || null,
    progress_metric: getText(props["Progress Metric"]) || null,
    progress_target: props["Progress Target"]?.number ?? null,
    progress_value: props["Progress Value"]?.number ?? null,
  };
}

export async function getAllEvents(): Promise<AppEvent[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: EVENTS_DB,
      filter: { property: "Completed", checkbox: { equals: false } },
      start_cursor: cursor,
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.map(pageToEvent);
}

export async function getAllEventsIncludingCompleted(): Promise<AppEvent[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: EVENTS_DB,
      start_cursor: cursor,
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.map(pageToEvent);
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
  progress_metric?: string;
  progress_target?: number;
}): Promise<AppEvent> {
  const props: Record<string, any> = {
    Title: { title: [{ text: { content: data.title } }] },
    Type: { select: { name: data.event_type } },
    Recurring: { checkbox: data.is_recurring ?? false },
    Completed: { checkbox: false },
    "Surface Days": { number: data.surface_days ?? 3 },
  };

  if (data.description) props["Description"] = { rich_text: [{ text: { content: data.description } }] };
  if (data.start_time) props["Start Time"] = { date: { start: data.start_time } };
  if (data.end_time) props["End Time"] = { date: { start: data.end_time } };
  if (data.due_date) props["Due Date"] = { date: { start: data.due_date } };
  if (data.recurrence_rule) props["Recurrence Rule"] = { rich_text: [{ text: { content: data.recurrence_rule } }] };
  if (data.time_of_day) props["Time of Day"] = { select: { name: data.time_of_day } };
  if (data.due_time) props["Due Time"] = { rich_text: [{ text: { content: data.due_time } }] };
  if (data.progress_metric) props["Progress Metric"] = { rich_text: [{ text: { content: data.progress_metric } }] };
  if (data.progress_target != null) props["Progress Target"] = { number: data.progress_target };

  const page = await notion.pages.create({
    parent: { data_source_id: EVENTS_DB },
    properties: props,
  }) as any;

  return pageToEvent(page);
}

export async function completeEvent(id: string): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: { Completed: { checkbox: true } },
  });
}

export async function updateEventProgress(id: string, progressValue: number): Promise<void> {
  const props: any = { "Progress Value": { number: progressValue } };
  if (progressValue > 0) {
    // Mark as complete if we need to - caller handles this logic
  }
  await notion.pages.update({ page_id: id, properties: props });
}

export async function deleteEvent(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
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
): Promise<void> {
  const props: Record<string, any> = {};
  if (data.title !== undefined) props["Title"] = { title: [{ text: { content: data.title } }] };
  if (data.description !== undefined) props["Description"] = { rich_text: [{ text: { content: data.description } }] };
  if (data.event_type !== undefined) props["Type"] = { select: { name: data.event_type } };
  if (data.start_time !== undefined) props["Start Time"] = data.start_time ? { date: { start: data.start_time } } : { date: null };
  if (data.end_time !== undefined) props["End Time"] = data.end_time ? { date: { start: data.end_time } } : { date: null };
  if (data.due_date !== undefined) props["Due Date"] = data.due_date ? { date: { start: data.due_date } } : { date: null };
  if (data.is_recurring !== undefined) props["Recurring"] = { checkbox: data.is_recurring };
  if (data.recurrence_rule !== undefined) props["Recurrence Rule"] = { rich_text: data.recurrence_rule ? [{ text: { content: data.recurrence_rule } }] : [] };
  if (data.surface_days !== undefined) props["Surface Days"] = { number: data.surface_days };
  if (data.time_of_day !== undefined) props["Time of Day"] = data.time_of_day ? { select: { name: data.time_of_day } } : { select: null };
  if (data.due_time !== undefined) props["Due Time"] = { rich_text: data.due_time ? [{ text: { content: data.due_time } }] : [] };
  if (data.progress_metric !== undefined) props["Progress Metric"] = { rich_text: data.progress_metric ? [{ text: { content: data.progress_metric } }] : [] };
  if (data.progress_target !== undefined) props["Progress Target"] = { number: data.progress_target };
  if (data.progress_value !== undefined) props["Progress Value"] = { number: data.progress_value };

  await notion.pages.update({ page_id: id, properties: props });
}
