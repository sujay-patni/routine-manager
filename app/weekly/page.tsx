export const dynamic = "force-dynamic";

import { getWeeklySummary } from "@/app/actions/habits";
import { getSettings } from "@/app/actions/settings";
import WeeklyClient from "./WeeklyClient";

export default async function WeeklyPage() {
  const [{ habits, weekStart, weekEnd }, settings] = await Promise.all([
    getWeeklySummary(),
    getSettings(),
  ]);

  return (
    <WeeklyClient
      habits={habits}
      weekStart={weekStart}
      weekEnd={weekEnd}
      timezone={settings?.timezone ?? "Asia/Kolkata"}
    />
  );
}
