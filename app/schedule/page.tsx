export const dynamic = "force-dynamic";

import { getUpcomingEvents } from "@/app/actions/events";
import { getSettings } from "@/app/actions/settings";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage() {
  const [events, settings] = await Promise.all([
    getUpcomingEvents(),
    getSettings(),
  ]);

  const timezone = settings?.timezone ?? "Asia/Kolkata";

  return <ScheduleClient events={events} timezone={timezone} />;
}
