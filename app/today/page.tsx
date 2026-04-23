export const dynamic = "force-dynamic";

import { getTodayHabits } from "@/app/actions/habits";
import { getTodayEvents } from "@/app/actions/events";
import TodayClient from "./TodayClient";
import { format, addDays, subDays, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function TodayPage({ searchParams }: Props) {
  const params = await searchParams;
  const dateStr = params.date;

  const [{ habits, today, weekStart, weekEnd, timezone, isLateNight }, events] = await Promise.all([
    getTodayHabits(dateStr),
    getTodayEvents(dateStr),
  ]);

  const todayDate = today ? parseISO(today) : new Date();
  const dayLabel = format(todayDate, "EEEE, MMM d");

  // Derive relative label using timezone-aware "now" so the server's UTC clock
  // doesn't cause off-by-one for users ahead of UTC (e.g. Asia/Kolkata UTC+5:30)
  const nowInTz = toZonedTime(new Date(), timezone);
  const nowStr = format(nowInTz, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(nowInTz, 1), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(nowInTz, 1), "yyyy-MM-dd");

  let relativeLabel = dayLabel;
  if (isLateNight && !dateStr) relativeLabel = "Today";
  else if (today === nowStr) relativeLabel = "Today";
  else if (today === tomorrowStr) relativeLabel = "Tomorrow";
  else if (today === yesterdayStr) relativeLabel = "Yesterday";

  return (
    <TodayClient
      habits={habits}
      events={events}
      today={today}
      weekStart={weekStart}
      weekEnd={weekEnd}
      dayLabel={dayLabel}
      relativeLabel={relativeLabel}
      dateStr={today}
      isLateNight={isLateNight}
    />
  );
}
