export const dynamic = "force-dynamic";

import { getAllEventsForCalendar } from "@/app/actions/events";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const events = await getAllEventsForCalendar();
  return <CalendarClient events={events} />;
}
