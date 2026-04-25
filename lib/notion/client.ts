import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_API_KEY });

export const HABITS_DB = process.env.NOTION_HABITS_DB_ID!;
export const COMPLETIONS_DB = process.env.NOTION_COMPLETIONS_DB_ID!;
export const EVENTS_DB = process.env.NOTION_EVENTS_DB_ID!;
export const SETTINGS_DB = process.env.NOTION_SETTINGS_DB_ID ?? "";
export const GROUPS_DB = process.env.NOTION_GROUPS_DB_ID ?? "";
