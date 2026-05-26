import { loadEnvConfig } from "@next/env";
import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "../lib/db/client";
import {
  allowedDevices,
  completions,
  events,
  groups,
  habits,
  settings,
  skips,
  vacations,
} from "../lib/db/schema";

loadEnvConfig(process.cwd());

async function count(table: PgTable) {
  const [row] = await getDb().select({ count: sql<number>`count(*)::int` }).from(table);
  return row.count;
}

async function main() {
  const db = getDb();

  const counts = {
    groups: await count(groups),
    habits: await count(habits),
    completions: await count(completions),
    events: await count(events),
    settings: await count(settings),
    skips: await count(skips),
    vacations: await count(vacations),
    allowedDevices: await count(allowedDevices),
  };

  console.table(counts);

  const duplicateCompletions = await db
    .select({
      habitId: completions.habitId,
      date: completions.date,
      count: sql<number>`count(*)::int`,
    })
    .from(completions)
    .groupBy(completions.habitId, completions.date)
    .having(sql`count(*) > 1`);

  const duplicateDaySkips = await db
    .select({
      itemType: skips.itemType,
      itemId: skips.itemId,
      date: skips.date,
      count: sql<number>`count(*)::int`,
    })
    .from(skips)
    .where(eq(skips.scope, "day"))
    .groupBy(skips.itemType, skips.itemId, skips.date)
    .having(sql`count(*) > 1`);

  const duplicateWeekSkips = await db
    .select({
      itemType: skips.itemType,
      itemId: skips.itemId,
      weekStart: skips.weekStart,
      weekEnd: skips.weekEnd,
      count: sql<number>`count(*)::int`,
    })
    .from(skips)
    .where(eq(skips.scope, "week"))
    .groupBy(skips.itemType, skips.itemId, skips.weekStart, skips.weekEnd)
    .having(sql`count(*) > 1`);

  const errors: string[] = [];
  if (counts.settings !== 1) errors.push(`expected exactly 1 settings row, found ${counts.settings}`);
  if (duplicateCompletions.length > 0) errors.push(`found ${duplicateCompletions.length} duplicate completion keys`);
  if (duplicateDaySkips.length > 0) errors.push(`found ${duplicateDaySkips.length} duplicate day skip keys`);
  if (duplicateWeekSkips.length > 0) errors.push(`found ${duplicateWeekSkips.length} duplicate week skip keys`);

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  console.log("Database verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
