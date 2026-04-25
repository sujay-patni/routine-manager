import { notion, GROUPS_DB } from "./client";
import { getText, getNumber } from "./helpers";
import type { Group } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function pageToGroup(page: any): Group {
  const props = page.properties;
  return {
    id: page.id,
    name: getText(props["Name"]),
    color: getText(props["Color"]) || "#8b5cf6",
    sort_order: getNumber(props["Sort Order"]) ?? null,
  };
}

export async function getAllGroups(): Promise<Group[]> {
  if (!GROUPS_DB) return [];
  const results: any[] = [];
  let cursor: string | undefined;
  const apiKey = process.env.NOTION_API_KEY ?? "";
  do {
    const body: Record<string, any> = { page_size: 50 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${GROUPS_DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion groups query failed: ${res.status} ${err}`);
    }
    const response: any = await res.json();
    results.push(...response.results);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results
    .map(pageToGroup)
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
}

export async function createGroup(data: { name: string; color: string }): Promise<Group> {
  const page: any = await notion.pages.create({
    parent: { database_id: GROUPS_DB },
    properties: {
      Name: { title: [{ text: { content: data.name } }] },
      Color: { rich_text: [{ text: { content: data.color } }] },
    },
  } as any);
  return pageToGroup(page);
}

export async function updateGroup(id: string, data: { name?: string; color?: string }): Promise<void> {
  const props: Record<string, any> = {};
  if (data.name !== undefined) props["Name"] = { title: [{ text: { content: data.name } }] };
  if (data.color !== undefined) props["Color"] = { rich_text: [{ text: { content: data.color } }] };
  await notion.pages.update({ page_id: id, properties: props } as any);
}

export async function deleteGroup(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true } as any);
}
