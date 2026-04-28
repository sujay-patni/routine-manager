export const dynamic = "force-dynamic";

import { getAllGroups } from "@/app/actions/groups";
import { getAllHabits } from "@/app/actions/habits";
import { getAllEventsForCalendar } from "@/app/actions/events";
import GroupsClient from "./GroupsClient";

export default async function GroupsPage() {
  const [groups, habits, events] = await Promise.all([
    getAllGroups(),
    getAllHabits(),
    getAllEventsForCalendar(),
  ]);

  return <GroupsClient groups={groups} habits={habits} events={events} />;
}
