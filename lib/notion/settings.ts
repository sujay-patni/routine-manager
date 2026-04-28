import { notion, SETTINGS_DB } from "./client";
import { getText } from "./helpers";
import type { AppSettings } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULT_PROGRESS_UNITS = ["mins", "hrs"];

function parseProgressUnits(raw: string): string[] {
  const custom = raw.split(",").map(s => s.trim()).filter(Boolean);
  const result = [...DEFAULT_PROGRESS_UNITS];
  for (const u of custom) {
    if (!result.includes(u)) result.push(u);
  }
  return result;
}

function pageToSettings(page: any): AppSettings {
  const props = page.properties;
  const rawUnits = getText(props["Progress Units"]) || "";
  return {
    id: page.id,
    timezone: getText(props["Timezone"]) || "Asia/Kolkata",
    week_start_day: props["Week Start Day"]?.number ?? 1,
    deadline_surface_days: props["Deadline Surface Days"]?.number ?? 3,
    day_start_hour: props["Day Start Hour"]?.number ?? 0,
    progress_units: rawUnits ? parseProgressUnits(rawUnits) : DEFAULT_PROGRESS_UNITS,
  };
}

export async function ensureProgressUnitsColumn(): Promise<void> {
  if (!SETTINGS_DB) return;
  try {
    await (notion.dataSources as any).update({
      data_source_id: SETTINGS_DB,
      properties: { "Progress Units": { rich_text: {} } },
    });
  } catch { /* column already exists or insufficient permission */ }
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
  const customUnits = (data.progress_units ?? DEFAULT_PROGRESS_UNITS)
    .filter(u => !DEFAULT_PROGRESS_UNITS.includes(u))
    .join(",");
  const page = await notion.pages.create({
    parent: { data_source_id: SETTINGS_DB },
    properties: {
      Title: { title: [{ text: { content: "App Settings" } }] },
      Timezone: { rich_text: [{ text: { content: data.timezone } }] },
      "Week Start Day": { number: data.week_start_day },
      "Deadline Surface Days": { number: data.deadline_surface_days },
      "Day Start Hour": { number: data.day_start_hour },
      "Progress Units": { rich_text: [{ text: { content: customUnits } }] },
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
  if (data.day_start_hour !== undefined) props["Day Start Hour"] = { number: data.day_start_hour };
  if (data.progress_units !== undefined) {
    const customUnits = data.progress_units.filter(u => !DEFAULT_PROGRESS_UNITS.includes(u)).join(",");
    props["Progress Units"] = { rich_text: [{ text: { content: customUnits } }] };
  }
  try {
    await notion.pages.update({ page_id: id, properties: props });
  } catch (e: any) {
    // If Progress Units column doesn't exist yet, create it then retry
    if (props["Progress Units"] && String(e).toLowerCase().includes("progress units")) {
      await ensureProgressUnitsColumn();
      await notion.pages.update({ page_id: id, properties: props });
    } else {
      throw e;
    }
  }
}
