export const dynamic = "force-dynamic";

import { getAllEventsForCalendar } from "@/app/actions/events";
import { getSettings } from "@/app/actions/settings";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const [events, settings] = await Promise.all([
    getAllEventsForCalendar(),
    getSettings(),
  ]);

  return (
    <CalendarClient
      events={events}
      weekStartDay={settings.week_start_day}
      timezone={settings.timezone}
    />
  );
}
