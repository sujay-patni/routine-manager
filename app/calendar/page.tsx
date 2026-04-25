export const dynamic = "force-dynamic";

import { getAllEventsForCalendar } from "@/app/actions/events";
import { getAllGroups } from "@/app/actions/groups";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const [events, groups] = await Promise.all([
    getAllEventsForCalendar(),
    getAllGroups(),
  ]);
  return <CalendarClient events={events} groups={groups} />;
}
