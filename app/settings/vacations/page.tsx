export const dynamic = "force-dynamic";

import { toZonedTime } from "date-fns-tz";
import { getAllGroups } from "@/app/actions/groups";
import { getAllHabits } from "@/app/actions/habits";
import { getVacations, getTemplates } from "@/app/actions/vacations";
import { getSettings } from "@/app/actions/settings";
import { formatDateForDB } from "@/lib/habit-logic";
import VacationsClient from "./VacationsClient";

export default async function VacationsPage() {
  const [vacations, templates, habits, groups, settings] = await Promise.all([
    getVacations(),
    getTemplates(),
    getAllHabits(),
    getAllGroups(),
    getSettings(),
  ]);

  const today = formatDateForDB(toZonedTime(new Date(), settings.timezone));

  return (
    <VacationsClient
      vacations={vacations}
      templates={templates}
      habits={habits}
      groups={groups}
      today={today}
    />
  );
}
