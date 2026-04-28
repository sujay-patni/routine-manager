export const dynamic = "force-dynamic";

import SettingsClient from "./SettingsClient";

function notionDbUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

export default async function SettingsPage() {
  return (
    <SettingsClient
      notionHabitsUrl={notionDbUrl(process.env.NOTION_HABITS_DB_ID)}
      notionEventsUrl={notionDbUrl(process.env.NOTION_EVENTS_DB_ID)}
      notionSettingsConfigured={!!process.env.NOTION_SETTINGS_DB_ID}
    />
  );
}
