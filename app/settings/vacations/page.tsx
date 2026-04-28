export const dynamic = "force-dynamic";

import { toZonedTime } from "date-fns-tz";
import { getAllGroups } from "@/app/actions/groups";
import { getAllHabits } from "@/app/actions/habits";
import { getVacations, getTemplates } from "@/app/actions/vacations";
import { getSettings } from "@/app/actions/settings";
import { formatDateForDB } from "@/lib/habit-logic";
import { VACATIONS_DB } from "@/lib/notion/client";
import VacationsClient from "./VacationsClient";

export default async function VacationsPage() {
  if (!VACATIONS_DB) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="font-fraunces font-normal text-[28px] tracking-tight leading-tight">Vacations</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <strong>Setup needed:</strong> add a <code className="bg-muted px-1 rounded">NOTION_VACATIONS_DB_ID</code> env var pointing to a Notion database with these properties: <em>Title</em> (title), <em>Is Template</em> (checkbox), <em>Start Date</em> (date), <em>End Date</em> (date), <em>Habit IDs</em> (text), <em>Group IDs</em> (text), <em>Note</em> (text).
          </div>
        </main>
      </div>
    );
  }

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
