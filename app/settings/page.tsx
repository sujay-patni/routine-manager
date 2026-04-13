export const dynamic = "force-dynamic";

import { getSettings } from "@/app/actions/settings";
import { getAllHabits } from "@/app/actions/habits";
import SettingsClient from "./SettingsClient";

function notionDbUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  // Notion DB URLs: https://notion.so/{id-without-hyphens}
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

export default async function SettingsPage() {
  const [settings, habits] = await Promise.all([
    getSettings(),
    getAllHabits(),
  ]);

  return (
    <SettingsClient
      settings={settings}
      habits={habits}
      notionHabitsUrl={notionDbUrl(process.env.NOTION_HABITS_DB_ID)}
      notionEventsUrl={notionDbUrl(process.env.NOTION_EVENTS_DB_ID)}
    />
  );
}
