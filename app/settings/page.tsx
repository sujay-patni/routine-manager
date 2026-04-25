export const dynamic = "force-dynamic";

import { getAllHabits } from "@/app/actions/habits";
import { getAllGroups } from "@/app/actions/groups";
import SettingsClient from "./SettingsClient";

function notionDbUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

export default async function SettingsPage() {
  const [habits, groups] = await Promise.all([getAllHabits(), getAllGroups()]);

  return (
    <SettingsClient
      habits={habits}
      groups={groups}
      notionHabitsUrl={notionDbUrl(process.env.NOTION_HABITS_DB_ID)}
      notionEventsUrl={notionDbUrl(process.env.NOTION_EVENTS_DB_ID)}
    />
  );
}
