import { randomUUID } from "crypto";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { getDb } from "./client";
import { skips } from "./schema";
import type { SkipItemType, SkipRecord, SkipScope } from "../domain/types";

type SkipRow = typeof skips.$inferSelect;

export function consumeSkipsDbUnavailable(): boolean {
  return false;
}

function rowToSkip(row: SkipRow): SkipRecord {
  return {
    id: row.id,
    item_type: row.itemType,
    item_id: row.itemId,
    scope: row.scope,
    date: row.date,
    week_start: row.weekStart,
    week_end: row.weekEnd,
  };
}

export async function getSkipsForWindow(date: string, weekStart: string, weekEnd: string): Promise<SkipRecord[]> {
  const rows = await getDb()
    .select()
    .from(skips)
    .where(
      or(
        and(eq(skips.scope, "day"), gte(skips.date, weekStart), lte(skips.date, weekEnd)),
        and(eq(skips.scope, "week"), eq(skips.weekStart, weekStart), eq(skips.weekEnd, weekEnd))
      )
    );
  return rows.map(rowToSkip);
}

export async function createSkip(data: {
  item_type: SkipItemType;
  item_id: string;
  item_title: string;
  scope: SkipScope;
  date: string;
  week_start?: string;
  week_end?: string;
}): Promise<SkipRecord> {
  const existing = await findSkip(data.item_type, data.item_id, data.scope, data.date, data.week_start, data.week_end);
  if (existing) return existing;

  try {
    const [row] = await getDb()
      .insert(skips)
      .values({
        id: randomUUID(),
        itemType: data.item_type,
        itemId: data.item_id,
        scope: data.scope,
        date: data.date,
        weekStart: data.scope === "week" ? data.week_start ?? data.date : null,
        weekEnd: data.scope === "week" ? data.week_end ?? data.date : null,
      })
      .returning();
    return rowToSkip(row);
  } catch (e) {
    const retry = await findSkip(data.item_type, data.item_id, data.scope, data.date, data.week_start, data.week_end);
    if (retry) return retry;
    throw e;
  }
}

export async function deleteSkip(skipId: string): Promise<void> {
  await getDb().delete(skips).where(eq(skips.id, skipId));
}

async function findSkip(
  itemType: SkipItemType,
  itemId: string,
  scope: SkipScope,
  date: string,
  weekStart?: string,
  weekEnd?: string
): Promise<SkipRecord | null> {
  const scopeFilter = scope === "day"
    ? eq(skips.date, date)
    : and(eq(skips.weekStart, weekStart ?? date), eq(skips.weekEnd, weekEnd ?? date));
  const [row] = await getDb()
    .select()
    .from(skips)
    .where(and(eq(skips.itemType, itemType), eq(skips.itemId, itemId), eq(skips.scope, scope), scopeFilter))
    .limit(1);
  return row ? rowToSkip(row) : null;
}
