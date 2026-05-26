import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "./client";
import { vacations } from "./schema";
import type { Vacation } from "../domain/types";

type VacationRow = typeof vacations.$inferSelect;

export function consumeVacationDbUnavailable(): boolean {
  return false;
}

function rowToVacation(row: VacationRow): Vacation {
  return {
    id: row.id,
    name: row.name,
    is_template: row.isTemplate,
    start_date: row.startDate,
    end_date: row.endDate,
    habit_ids: Array.isArray(row.habitIds) ? row.habitIds : [],
    group_ids: Array.isArray(row.groupIds) ? row.groupIds : [],
    note: row.note,
  };
}

export async function getActiveVacations(date: string): Promise<Vacation[]> {
  return getVacationsOverlapping(date, date);
}

export async function getVacationsOverlapping(rangeStart: string, rangeEnd: string): Promise<Vacation[]> {
  const rows = await getDb()
    .select()
    .from(vacations)
    .where(and(eq(vacations.isTemplate, false), lte(vacations.startDate, rangeEnd), gte(vacations.endDate, rangeStart)));
  return rows.map(rowToVacation);
}

export async function getAllVacations(): Promise<Vacation[]> {
  const rows = await getDb()
    .select()
    .from(vacations)
    .where(eq(vacations.isTemplate, false))
    .orderBy(desc(vacations.startDate));
  return rows.map(rowToVacation);
}

export async function getVacationTemplates(): Promise<Vacation[]> {
  const rows = await getDb()
    .select()
    .from(vacations)
    .where(eq(vacations.isTemplate, true))
    .orderBy(asc(vacations.name));
  return rows.map(rowToVacation);
}

export async function getVacation(id: string): Promise<Vacation | null> {
  const [row] = await getDb().select().from(vacations).where(eq(vacations.id, id)).limit(1);
  return row ? rowToVacation(row) : null;
}

export interface VacationInput {
  name: string;
  is_template: boolean;
  start_date?: string | null;
  end_date?: string | null;
  habit_ids: string[];
  group_ids: string[];
  note?: string | null;
}

export async function createVacation(data: VacationInput): Promise<Vacation> {
  const [row] = await getDb()
    .insert(vacations)
    .values({
      id: randomUUID(),
      name: data.name,
      isTemplate: data.is_template,
      startDate: data.is_template ? null : data.start_date ?? null,
      endDate: data.is_template ? null : data.end_date ?? null,
      habitIds: data.habit_ids,
      groupIds: data.group_ids,
      note: data.note ?? null,
    })
    .returning();
  return rowToVacation(row);
}

export async function updateVacation(id: string, data: VacationInput): Promise<Vacation> {
  const [row] = await getDb()
    .update(vacations)
    .set({
      name: data.name,
      isTemplate: data.is_template,
      startDate: data.is_template ? null : data.start_date ?? null,
      endDate: data.is_template ? null : data.end_date ?? null,
      habitIds: data.habit_ids,
      groupIds: data.group_ids,
      note: data.note ?? null,
    })
    .where(eq(vacations.id, id))
    .returning();
  return rowToVacation(row);
}

export async function deleteVacation(id: string): Promise<void> {
  await getDb().delete(vacations).where(eq(vacations.id, id));
}
