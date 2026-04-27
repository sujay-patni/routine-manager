import { notion, HABITS_DB, COMPLETIONS_DB } from "./client";
import { getText, getSelect, getCheckbox, getDate, getRelationIds } from "./helpers";
import type { Habit, Completion, HabitFrequency, TimeOfDay, ProgressPeriod } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function pageToHabit(page: any): Habit {
  const props = page.properties;
  return {
    id: page.id,
    name: getText(props["Name"]),
    description: getText(props["Description"]) || null,
    frequency: (getSelect(props["Frequency"]) as HabitFrequency) || "daily",
    weekly_target: props["Weekly Target"]?.number ?? null,
    color: getSelect(props["Color"]) || "#6366f1",
    icon: getText(props["Icon"]) || "✅",
    is_active: getCheckbox(props["Active"]),
    created_at: page.created_time,
    time_of_day: (getSelect(props["Time of Day"]) as TimeOfDay) || null,
    exact_time: getText(props["Exact Time"]) || null,
    specific_days: getText(props["Specific Days"]) || null,
    progress_metric: getText(props["Progress Metric"]) || null,
    progress_target: props["Progress Target"]?.number ?? null,
    progress_start: props["Progress Start"]?.number ?? null,
    progress_period: (getSelect(props["Progress Period"]) as ProgressPeriod) || null,
    progress_conversion: props["Progress Conversion"]?.number ?? null,
    progress_conversion_base: props["Progress Conversion Base"]?.number ?? null,
    duration_minutes: props["Duration"]?.number ?? null,
    sort_order: props["Sort Order"]?.number ?? null,
    group_id: getRelationIds(props["Group"])[0] ?? null,
  };
}

async function queryWithBackoff(params: any): Promise<any> {
  let retries = 4;
  let delay = 500;
  while (true) {
    try {
      return await notion.dataSources.query({ ...params, page_size: params.page_size || 50 });
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      const isTransient =
        e.status === 503 ||
        e.status === 502 ||
        e.status === 429 ||
        msg.includes("temporarily unavailable") ||
        msg.includes("Could not find database");
      if (retries <= 0 || !isTransient) throw e;
      await new Promise((res) => setTimeout(res, delay));
      delay = Math.min(delay * 2, 3000);
      retries--;
    }
  }
}

function pageToCompletion(page: any): Completion {
  const props = page.properties;
  return {
    id: page.id,
    habit_id: getRelationIds(props["Habit"])[0] ?? "",
    date: getDate(props["Date"]),
    note: getText(props["Note"]) || null,
    progress_value: props["Progress Value"]?.number ?? null,
    duration_actual: props["Duration Actual"]?.number ?? null,
  };
}

export async function getAllHabits(): Promise<Habit[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryWithBackoff({
      data_source_id: HABITS_DB,
      filter: { property: "Active", checkbox: { equals: true } },
      start_cursor: cursor,
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.map(pageToHabit);
}

export async function getAllHabitsIncludingInactive(): Promise<Habit[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryWithBackoff({
      data_source_id: HABITS_DB,
      start_cursor: cursor,
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.map(pageToHabit);
}

export async function getCompletionsForWeek(
  weekStart: string,
  weekEnd: string
): Promise<Completion[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryWithBackoff({
      data_source_id: COMPLETIONS_DB,
      filter: {
        and: [
          { property: "Date", date: { on_or_after: weekStart } },
          { property: "Date", date: { on_or_before: weekEnd } },
        ],
      },
      start_cursor: cursor,
    });
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results.map(pageToCompletion);
}

export async function getCompletionsForDate(date: string): Promise<Completion[]> {
  const response = await queryWithBackoff({
    data_source_id: COMPLETIONS_DB,
    filter: { property: "Date", date: { equals: date } },
  }) as any;
  return response.results.map(pageToCompletion);
}

async function ensureCompletionProgressColumn(): Promise<void> {
  await (notion.dataSources as any).update({
    data_source_id: COMPLETIONS_DB,
    properties: { "Progress Value": { number: {} } },
  });
}

async function ensureCompletionDurationColumn(): Promise<void> {
  await (notion.dataSources as any).update({
    data_source_id: COMPLETIONS_DB,
    properties: { "Duration Actual": { number: {} } },
  });
}

export async function ensureHabitSortOrderColumn(): Promise<void> {
  await (notion.dataSources as any).update({
    data_source_id: HABITS_DB,
    properties: { "Sort Order": { number: {} } },
  });
}

export async function ensureHabitDurationColumns(): Promise<void> {
  await (notion.dataSources as any).update({
    data_source_id: HABITS_DB,
    properties: {
      "Duration": { number: {} },
      "Progress Conversion": { number: {} },
      "Progress Conversion Base": { number: {} },
    },
  });
}

export async function createCompletion(
  habitId: string,
  date: string,
  habitName: string,
  progressValue?: number,
  durationActual?: number
): Promise<Completion> {
  const props: any = {
    Title: { title: [{ text: { content: `${habitName} – ${date}` } }] },
    Habit: { relation: [{ id: habitId }] },
    Date: { date: { start: date } },
  };
  if (progressValue !== undefined) props["Progress Value"] = { number: progressValue };
  if (durationActual !== undefined) props["Duration Actual"] = { number: durationActual };

  try {
    const page = await notion.pages.create({
      parent: { data_source_id: COMPLETIONS_DB },
      properties: props,
    }) as any;
    return pageToCompletion(page);
  } catch (e: any) {
    if (progressValue === undefined && durationActual === undefined) throw e;
    const msg: string = e?.message ?? String(e);
    const isMissingColumn =
      msg.includes("is not a property that exists") ||
      msg.includes("not a property");
    if (!isMissingColumn) throw e;
    // Columns missing — ensure them, then retry with only base props
    await ensureCompletionProgressColumn();
    await ensureCompletionDurationColumn();
    const baseProps = {
      Title: props.Title,
      Habit: props.Habit,
      Date: props.Date,
    };
    const page = await notion.pages.create({
      parent: { data_source_id: COMPLETIONS_DB },
      properties: baseProps,
    }) as any;
    const updateProps: any = {};
    if (progressValue !== undefined) updateProps["Progress Value"] = { number: progressValue };
    if (durationActual !== undefined) updateProps["Duration Actual"] = { number: durationActual };
    if (Object.keys(updateProps).length > 0) {
      await notion.pages.update({ page_id: page.id, properties: updateProps });
    }
    return pageToCompletion(page);
  }
}

export async function deleteCompletion(completionId: string): Promise<void> {
  await notion.pages.update({ page_id: completionId, in_trash: true });
}

export async function findCompletion(habitId: string, date: string): Promise<Completion | null> {
  const response = await notion.dataSources.query({
    data_source_id: COMPLETIONS_DB,
    filter: {
      and: [
        { property: "Habit", relation: { contains: habitId } },
        { property: "Date", date: { equals: date } },
      ],
    },
    page_size: 1,
  }) as any;
  const page = response.results[0];
  return page ? pageToCompletion(page) : null;
}

export async function updateCompletionProgress(
  completionId: string,
  progressValue: number,
  durationActual?: number
): Promise<void> {
  const props: any = { "Progress Value": { number: progressValue } };
  if (durationActual !== undefined) props["Duration Actual"] = { number: durationActual };
  try {
    await notion.pages.update({ page_id: completionId, properties: props });
  } catch (e: any) {
    const msg: string = e?.message ?? String(e);
    const isMissingColumn =
      msg.includes("is not a property that exists") ||
      msg.includes("not a property");
    if (!isMissingColumn) throw e;
    await ensureCompletionProgressColumn();
    await ensureCompletionDurationColumn();
    await notion.pages.update({ page_id: completionId, properties: props });
  }
}

export async function findAndDeleteCompletion(habitId: string, date: string): Promise<void> {
  const response = await notion.dataSources.query({
    data_source_id: COMPLETIONS_DB,
    filter: {
      and: [
        { property: "Habit", relation: { contains: habitId } },
        { property: "Date", date: { equals: date } },
      ],
    },
    page_size: 1,
  }) as any;

  const page = response.results[0];
  if (page) {
    await notion.pages.update({ page_id: page.id, in_trash: true });
  }
}

export async function createHabit(data: {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  weekly_target?: number;
  color?: string;
  icon?: string;
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
  sort_order?: number;
  group_id?: string | null;
}): Promise<Habit> {
  const props: any = {
    Name: { title: [{ text: { content: data.name } }] },
    Description: { rich_text: data.description ? [{ text: { content: data.description } }] : [] },
    Frequency: { select: { name: data.frequency } },
    "Weekly Target": data.weekly_target != null ? { number: data.weekly_target } : { number: null },
    Color: { select: { name: data.color ?? "#6366f1" } },
    Icon: { rich_text: [{ text: { content: data.icon ?? "" } }] },
    Active: { checkbox: true },
  };

  if (data.time_of_day) props["Time of Day"] = { select: { name: data.time_of_day } };
  if (data.exact_time) props["Exact Time"] = { rich_text: [{ text: { content: data.exact_time } }] };
  if (data.specific_days) props["Specific Days"] = { rich_text: [{ text: { content: data.specific_days } }] };
  if (data.progress_metric) props["Progress Metric"] = { rich_text: [{ text: { content: data.progress_metric } }] };
  if (data.progress_target != null) props["Progress Target"] = { number: data.progress_target };
  if (data.progress_start != null) props["Progress Start"] = { number: data.progress_start };
  if (data.progress_period) props["Progress Period"] = { select: { name: data.progress_period } };
  if (data.progress_conversion != null) props["Progress Conversion"] = { number: data.progress_conversion };
  if (data.progress_conversion_base != null) props["Progress Conversion Base"] = { number: data.progress_conversion_base };
  if (data.duration_minutes != null) props["Duration"] = { number: data.duration_minutes };
  if (data.sort_order != null) props["Sort Order"] = { number: data.sort_order };
  if (data.group_id) props["Group"] = { relation: [{ id: data.group_id }] };

  const page = await notion.pages.create({
    parent: { data_source_id: HABITS_DB },
    properties: props,
  }) as any;

  return pageToHabit(page);
}

export async function deleteHabit(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

export async function updateHabit(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    frequency: HabitFrequency;
    weekly_target: number | null;
    color: string;
    icon: string;
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
    group_id: string | null;
  }>
): Promise<void> {
  const props: Record<string, any> = {};
  if (data.name !== undefined) props["Name"] = { title: [{ text: { content: data.name } }] };
  if (data.description !== undefined) props["Description"] = { rich_text: data.description ? [{ text: { content: data.description } }] : [] };
  if (data.frequency !== undefined) props["Frequency"] = { select: { name: data.frequency } };
  if (data.weekly_target !== undefined) props["Weekly Target"] = { number: data.weekly_target };
  if (data.color !== undefined) props["Color"] = { select: { name: data.color } };
  if (data.icon !== undefined) props["Icon"] = { rich_text: [{ text: { content: data.icon } }] };
  if (data.is_active !== undefined) props["Active"] = { checkbox: data.is_active };
  if (data.time_of_day !== undefined) props["Time of Day"] = data.time_of_day ? { select: { name: data.time_of_day } } : { select: null };
  if (data.exact_time !== undefined) props["Exact Time"] = { rich_text: data.exact_time ? [{ text: { content: data.exact_time } }] : [] };
  if (data.specific_days !== undefined) props["Specific Days"] = { rich_text: data.specific_days ? [{ text: { content: data.specific_days } }] : [] };
  if (data.progress_metric !== undefined) props["Progress Metric"] = { rich_text: data.progress_metric ? [{ text: { content: data.progress_metric } }] : [] };
  if (data.progress_target !== undefined) props["Progress Target"] = { number: data.progress_target };
  if (data.progress_start !== undefined) props["Progress Start"] = { number: data.progress_start };
  if (data.progress_period !== undefined) props["Progress Period"] = data.progress_period ? { select: { name: data.progress_period } } : { select: null };
  if (data.progress_conversion !== undefined) props["Progress Conversion"] = { number: data.progress_conversion };
  if (data.progress_conversion_base !== undefined) props["Progress Conversion Base"] = { number: data.progress_conversion_base };
  if (data.duration_minutes !== undefined) props["Duration"] = { number: data.duration_minutes };
  if (data.sort_order !== undefined) props["Sort Order"] = { number: data.sort_order };
  if (data.group_id !== undefined) props["Group"] = data.group_id ? { relation: [{ id: data.group_id }] } : { relation: [] };

  await notion.pages.update({ page_id: id, properties: props });
}
