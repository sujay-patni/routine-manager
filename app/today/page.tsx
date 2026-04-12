export const dynamic = "force-dynamic";

import { getTodayHabits } from "@/app/actions/habits";
import { getTodayEvents } from "@/app/actions/events";
import TodayClient from "./TodayClient";
import { format, parseISO } from "date-fns";

export default async function TodayPage() {
  const [{ habits, today, weekEnd }, events] = await Promise.all([
    getTodayHabits(),
    getTodayEvents(),
  ]);

  // Format today's date for display
  const todayDate = today ? parseISO(today) : new Date();
  const dayLabel = format(todayDate, "EEEE, MMM d");

  return (
    <TodayClient
      habits={habits}
      events={events}
      today={today}
      weekEnd={weekEnd}
      dayLabel={dayLabel}
    />
  );
}
