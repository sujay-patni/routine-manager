import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { groups } from "./schema";
import type { Group } from "../domain/types";

type GroupRow = typeof groups.$inferSelect;

function rowToGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sort_order: row.sortOrder,
  };
}

export async function getAllGroups(): Promise<Group[]> {
  const rows = await getDb().select().from(groups).orderBy(asc(groups.sortOrder), asc(groups.name));
  return [...rows]
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name))
    .map(rowToGroup);
}

export async function createGroup(data: { name: string; color: string }): Promise<Group> {
  const [row] = await getDb()
    .insert(groups)
    .values({
      id: randomUUID(),
      name: data.name,
      color: data.color,
    })
    .returning();
  return rowToGroup(row);
}

export async function updateGroup(id: string, data: { name?: string; color?: string }): Promise<void> {
  await getDb()
    .update(groups)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
    })
    .where(eq(groups.id, id));
}

export async function deleteGroup(id: string): Promise<void> {
  await getDb().delete(groups).where(eq(groups.id, id));
}
