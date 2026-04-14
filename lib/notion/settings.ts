import { notion, SETTINGS_DB } from "./client";
import { getText } from "./helpers";
import type { AppSettings } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function pageToSettings(page: any): AppSettings {
  const props = page.properties;
  return {
    id: page.id,
    timezone: getText(props["Timezone"]) || "Asia/Kolkata",
    week_start_day: props["Week Start Day"]?.number ?? 1,
    deadline_surface_days: props["Deadline Surface Days"]?.number ?? 3,
  };
}

export async function getAppSettings(): Promise<AppSettings | null> {
  if (!SETTINGS_DB) return null;
  try {
    const response = await notion.dataSources.query({
      data_source_id: SETTINGS_DB,
      page_size: 1,
    }) as any;
    const page = response.results[0];
    if (!page) return null;
    return pageToSettings(page);
  } catch {
    return null;
  }
}

export async function createAppSettings(data: Omit<AppSettings, "id">): Promise<AppSettings> {
  const page = await notion.pages.create({
    parent: { data_source_id: SETTINGS_DB },
    properties: {
      Title: { title: [{ text: { content: "App Settings" } }] },
      Timezone: { rich_text: [{ text: { content: data.timezone } }] },
      "Week Start Day": { number: data.week_start_day },
      "Deadline Surface Days": { number: data.deadline_surface_days },
    },
  }) as any;
  return pageToSettings(page);
}

export async function updateAppSettings(
  id: string,
  data: Partial<Omit<AppSettings, "id">>
): Promise<void> {
  const props: any = {};
  if (data.timezone !== undefined) props["Timezone"] = { rich_text: [{ text: { content: data.timezone } }] };
  if (data.week_start_day !== undefined) props["Week Start Day"] = { number: data.week_start_day };
  if (data.deadline_surface_days !== undefined) props["Deadline Surface Days"] = { number: data.deadline_surface_days };
  await notion.pages.update({ page_id: id, properties: props });
}
