export const dynamic = "force-dynamic";

import { getAllHabits } from "@/app/actions/habits";
import SettingsClient from "./SettingsClient";

function notionDbUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

export default async function SettingsPage() {
  const habits = await getAllHabits();

  return (
    <SettingsClient
      habits={habits}
      notionHabitsUrl={notionDbUrl(process.env.NOTION_HABITS_DB_ID)}
      notionEventsUrl={notionDbUrl(process.env.NOTION_EVENTS_DB_ID)}
    />
  );
}
