import { notion, VACATIONS_DB } from "./client";
import { getCheckbox, getDate, getText } from "./helpers";
import type { Vacation } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

let vacationDbUnavailable = false;

export function consumeVacationDbUnavailable(): boolean {
  const value = vacationDbUnavailable;
  vacationDbUnavailable = false;
  return value;
}

function requireDb() {
  if (!VACATIONS_DB) throw new Error("no_vacations_db");
}

function isMissingVacationDbError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Could not find database with ID") ||
    msg.includes("Could not find data source with ID") ||
    msg.includes("Make sure the relevant pages and databases are shared")
  );
}

function splitIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinIds(ids: string[]): string {
  return ids.filter(Boolean).join(",");
}

function pageToVacation(page: any): Vacation {
  const props = page.properties;
  return {
    id: page.id,
    name: getText(props["Title"]) || getText(props["Name"]),
    is_template: getCheckbox(props["Is Template"]),
    start_date: getDate(props["Start Date"]) || null,
    end_date: getDate(props["End Date"]) || null,
    habit_ids: splitIds(getText(props["Habit IDs"])),
    group_ids: splitIds(getText(props["Group IDs"])),
    note: getText(props["Note"]) || null,
  };
}

async function queryAll(filter: any, sorts?: any[]): Promise<Vacation[]> {
  if (!VACATIONS_DB) return [];
  const results: any[] = [];
  let cursor: string | undefined;
  try {
    do {
      const response = (await notion.dataSources.query({
        data_source_id: VACATIONS_DB,
        filter,
        sorts,
        start_cursor: cursor,
        page_size: 100,
      })) as any;
      results.push(...response.results);
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
  } catch (e) {
    if (isMissingVacationDbError(e)) {
      vacationDbUnavailable = true;
      console.warn("Vacation database is unavailable; continuing without vacation pauses.");
      return [];
    }
    throw e;
  }
  return results.map(pageToVacation);
}

export async function getActiveVacations(date: string): Promise<Vacation[]> {
  return getVacationsOverlapping(date, date);
}

export async function getVacationsOverlapping(rangeStart: string, rangeEnd: string): Promise<Vacation[]> {
  if (!VACATIONS_DB) return [];
  return queryAll({
    and: [
      { property: "Is Template", checkbox: { equals: false } },
      { property: "Start Date", date: { on_or_before: rangeEnd } },
      { property: "End Date", date: { on_or_after: rangeStart } },
    ],
  });
}

export async function getAllVacations(): Promise<Vacation[]> {
  if (!VACATIONS_DB) return [];
  return queryAll(
    { property: "Is Template", checkbox: { equals: false } },
    [{ property: "Start Date", direction: "descending" }]
  );
}

export async function getVacationTemplates(): Promise<Vacation[]> {
  if (!VACATIONS_DB) return [];
  return queryAll(
    { property: "Is Template", checkbox: { equals: true } },
    [{ property: "Title", direction: "ascending" }]
  );
}

export async function getVacation(id: string): Promise<Vacation | null> {
  requireDb();
  const page = (await notion.pages.retrieve({ page_id: id })) as any;
  return page ? pageToVacation(page) : null;
}

export interface VacationInput {
  name: string;
  is_template: boolean;
  start_date?: string | null;
  end_date?: string | null;
  habit_ids: string[];
  group_ids: string[];
  note?: string | null;
}

function buildProps(data: VacationInput): Record<string, any> {
  const props: Record<string, any> = {
    Title: { title: [{ text: { content: data.name } }] },
    "Is Template": { checkbox: !!data.is_template },
    "Habit IDs": { rich_text: [{ text: { content: joinIds(data.habit_ids) } }] },
    "Group IDs": { rich_text: [{ text: { content: joinIds(data.group_ids) } }] },
    Note: { rich_text: [{ text: { content: data.note ?? "" } }] },
  };
  if (data.is_template) {
    props["Start Date"] = { date: null };
    props["End Date"] = { date: null };
  } else {
    props["Start Date"] = data.start_date ? { date: { start: data.start_date } } : { date: null };
    props["End Date"] = data.end_date ? { date: { start: data.end_date } } : { date: null };
  }
  return props;
}

export async function createVacation(data: VacationInput): Promise<Vacation> {
  requireDb();
  const page = (await notion.pages.create({
    parent: { data_source_id: VACATIONS_DB },
    properties: buildProps(data),
  })) as any;
  return pageToVacation(page);
}

export async function updateVacation(id: string, data: VacationInput): Promise<Vacation> {
  requireDb();
  const page = (await notion.pages.update({
    page_id: id,
    properties: buildProps(data),
  })) as any;
  return pageToVacation(page);
}

export async function deleteVacation(id: string): Promise<void> {
  requireDb();
  await notion.pages.update({ page_id: id, in_trash: true });
}
