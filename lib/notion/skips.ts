import { notion, SKIPS_DB } from "./client";
import { getDate, getSelect, getText } from "./helpers";
import type { SkipItemType, SkipRecord, SkipScope } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

let skipsDbUnavailable = false;

export function consumeSkipsDbUnavailable(): boolean {
  const value = skipsDbUnavailable;
  skipsDbUnavailable = false;
  return value;
}

function requireSkipsDb() {
  if (!SKIPS_DB) throw new Error("no_skips_db");
}

function isMissingSkipsDbError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Could not find database with ID") ||
    msg.includes("Could not find data source with ID") ||
    msg.includes("Make sure the relevant pages and databases are shared")
  );
}

function pageToSkip(page: any): SkipRecord {
  const props = page.properties;
  return {
    id: page.id,
    item_type: (getSelect(props["Item Type"]) as SkipItemType) || "habit",
    item_id: getText(props["Item ID"]),
    scope: (getSelect(props["Scope"]) as SkipScope) || "day",
    date: getDate(props["Date"]) || null,
    week_start: getDate(props["Week Start"]) || null,
    week_end: getDate(props["Week End"]) || null,
  };
}

export async function getSkipsForWindow(date: string, weekStart: string, weekEnd: string): Promise<SkipRecord[]> {
  if (!SKIPS_DB) return [];
  const results: any[] = [];
  let cursor: string | undefined;

  try {
    do {
      const response = await notion.dataSources.query({
        data_source_id: SKIPS_DB,
        filter: {
          or: [
            {
              and: [
                { property: "Scope", select: { equals: "day" } },
                { property: "Date", date: { equals: date } },
              ],
            },
            {
              and: [
                { property: "Scope", select: { equals: "week" } },
                { property: "Week Start", date: { equals: weekStart } },
                { property: "Week End", date: { equals: weekEnd } },
              ],
            },
          ],
        },
        start_cursor: cursor,
        page_size: 50,
      }) as any;
      results.push(...response.results);
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  } catch (e) {
    if (isMissingSkipsDbError(e)) {
      skipsDbUnavailable = true;
      console.warn("Skips database is unavailable; continuing without skip records.");
      return [];
    }
    throw e;
  }

  return results.map(pageToSkip);
}

export async function createSkip(data: {
  item_type: SkipItemType;
  item_id: string;
  item_title: string;
  scope: SkipScope;
  date: string;
  week_start?: string;
  week_end?: string;
}): Promise<SkipRecord> {
  requireSkipsDb();

  const existing = await findSkip(data.item_type, data.item_id, data.scope, data.date, data.week_start, data.week_end);
  if (existing) return existing;

  const props: Record<string, any> = {
    Title: { title: [{ text: { content: data.item_title } }] },
    "Item Type": { select: { name: data.item_type } },
    "Item ID": { rich_text: [{ text: { content: data.item_id } }] },
    Scope: { select: { name: data.scope } },
  };

  if (data.scope === "day") {
    props.Date = { date: { start: data.date } };
  } else {
    props.Date = { date: { start: data.date } };
    props["Week Start"] = { date: { start: data.week_start ?? data.date } };
    props["Week End"] = { date: { start: data.week_end ?? data.date } };
  }

  const page = await notion.pages.create({
    parent: { data_source_id: SKIPS_DB },
    properties: props,
  }) as any;

  return pageToSkip(page);
}

export async function deleteSkip(skipId: string): Promise<void> {
  requireSkipsDb();
  await notion.pages.update({ page_id: skipId, in_trash: true });
}

async function findSkip(
  itemType: SkipItemType,
  itemId: string,
  scope: SkipScope,
  date: string,
  weekStart?: string,
  weekEnd?: string
): Promise<SkipRecord | null> {
  requireSkipsDb();
  const scopeFilter = scope === "day"
    ? { property: "Date", date: { equals: date } }
    : {
        and: [
          { property: "Week Start", date: { equals: weekStart ?? date } },
          { property: "Week End", date: { equals: weekEnd ?? date } },
        ],
      };
  const response = await notion.dataSources.query({
    data_source_id: SKIPS_DB,
    filter: {
      and: [
        { property: "Item Type", select: { equals: itemType } },
        { property: "Item ID", rich_text: { equals: itemId } },
        { property: "Scope", select: { equals: scope } },
        scopeFilter,
      ],
    },
    page_size: 1,
  }) as any;
  const page = response.results[0];
  return page ? pageToSkip(page) : null;
}
