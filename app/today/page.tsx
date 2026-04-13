export const dynamic = "force-dynamic";

import { getTodayHabits } from "@/app/actions/habits";
import { getTodayEvents } from "@/app/actions/events";
import TodayClient from "./TodayClient";
import { format, parseISO } from "date-fns";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function TodayPage({ searchParams }: Props) {
  const params = await searchParams;
  const dateStr = params.date;

  const [{ habits, today, weekEnd }, events] = await Promise.all([
    getTodayHabits(dateStr),
    getTodayEvents(dateStr),
  ]);

  const todayDate = today ? parseISO(today) : new Date();
  const dayLabel = format(todayDate, "EEEE, MMM d");

  // Relative label
  const now = new Date();
  const nowStr = format(now, "yyyy-MM-dd");
  const tomorrowStr = format(new Date(now.getTime() + 86400000), "yyyy-MM-dd");
  const yesterdayStr = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");

  let relativeLabel = dayLabel;
  if (today === nowStr) relativeLabel = "Today";
  else if (today === tomorrowStr) relativeLabel = "Tomorrow";
  else if (today === yesterdayStr) relativeLabel = "Yesterday";

  return (
    <TodayClient
      habits={habits}
      events={events}
      today={today}
      weekEnd={weekEnd}
      dayLabel={dayLabel}
      relativeLabel={relativeLabel}
      dateStr={today}
    />
  );
}
