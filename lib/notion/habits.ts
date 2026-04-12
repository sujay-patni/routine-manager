import { notion, HABITS_DB, COMPLETIONS_DB } from "./client";
import { getText, getSelect, getCheckbox, getDate, getRelationIds } from "./helpers";
import type { Habit, Completion } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function pageToHabit(page: any): Habit {
  const props = page.properties;
  return {
    id: page.id,
    name: getText(props["Name"]),
    description: getText(props["Description"]) || null,
    frequency: (getSelect(props["Frequency"]) as "daily" | "weekly") || "daily",
    weekly_target: props["Weekly Target"]?.number ?? null,
    color: getSelect(props["Color"]) || "indigo",
    icon: getText(props["Icon"]) || "✅",
    is_active: getCheckbox(props["Active"]),
    created_at: page.created_time,
  };
}

function pageToCompletion(page: any): Completion {
  const props = page.properties;
  return {
    id: page.id,
    habit_id: getRelationIds(props["Habit"])[0] ?? "",
    date: getDate(props["Date"]),
    note: getText(props["Note"]) || null,
  };
}

export async function getAllHabits(): Promise<Habit[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: HABITS_DB,
      filter: { property: "Active", checkbox: { equals: true } },
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
    const response = await notion.dataSources.query({
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

export async function createCompletion(
  habitId: string,
  date: string,
  habitName: string
): Promise<Completion> {
  const page = await notion.pages.create({
    parent: { data_source_id: COMPLETIONS_DB },
    properties: {
      Title: { title: [{ text: { content: `${habitName} – ${date}` } }] },
      Habit: { relation: [{ id: habitId }] },
      Date: { date: { start: date } },
    },
  }) as any;

  return pageToCompletion(page);
}

export async function deleteCompletion(completionId: string): Promise<void> {
  await notion.pages.update({ page_id: completionId, in_trash: true });
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
  frequency: "daily" | "weekly";
  weekly_target?: number;
  color: string;
  icon: string;
}): Promise<Habit> {
  const page = await notion.pages.create({
    parent: { data_source_id: HABITS_DB },
    properties: {
      Name: { title: [{ text: { content: data.name } }] },
      Description: { rich_text: data.description ? [{ text: { content: data.description } }] : [] },
      Frequency: { select: { name: data.frequency } },
      "Weekly Target": data.weekly_target != null ? { number: data.weekly_target } : { number: null },
      Color: { select: { name: data.color } },
      Icon: { rich_text: [{ text: { content: data.icon } }] },
      Active: { checkbox: true },
    },
  }) as any;

  return pageToHabit(page);
}

export async function updateHabit(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    frequency: "daily" | "weekly";
    weekly_target: number | null;
    color: string;
    icon: string;
    is_active: boolean;
  }>
): Promise<void> {
  const props: Record<string, any> = {};
  if (data.name !== undefined) props["Name"] = { title: [{ text: { content: data.name } }] };
  if (data.description !== undefined) props["Description"] = { rich_text: [{ text: { content: data.description } }] };
  if (data.frequency !== undefined) props["Frequency"] = { select: { name: data.frequency } };
  if (data.weekly_target !== undefined) props["Weekly Target"] = { number: data.weekly_target };
  if (data.color !== undefined) props["Color"] = { select: { name: data.color } };
  if (data.icon !== undefined) props["Icon"] = { rich_text: [{ text: { content: data.icon } }] };
  if (data.is_active !== undefined) props["Active"] = { checkbox: data.is_active };

  await notion.pages.update({ page_id: id, properties: props });
}
