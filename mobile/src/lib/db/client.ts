import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import * as schema from "./schema";

export const DB_NAME = "routine.db";

let sqlite: SQLiteDatabase | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getSqlite(): SQLiteDatabase {
  if (!sqlite) sqlite = openDatabaseSync(DB_NAME);
  return sqlite;
}

export function getDb() {
  if (!db) db = drizzle(getSqlite(), { schema });
  return db;
}

// Bump DATABASE_VERSION and add a step below whenever the schema changes.
const DATABASE_VERSION = 1;

export async function migrateDb(): Promise<void> {
  const conn = getSqlite();
  await conn.execAsync("PRAGMA journal_mode = WAL");
  const row = await conn.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  if (current < 1) {
    await conn.execAsync(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#8b5cf6',
        sort_order INTEGER
      );
      CREATE INDEX IF NOT EXISTS groups_sort_order_idx ON groups (sort_order);

      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        frequency TEXT NOT NULL DEFAULT 'daily',
        weekly_target REAL,
        color TEXT NOT NULL DEFAULT '#6366f1',
        icon TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        time_of_day TEXT,
        exact_time TEXT,
        specific_days TEXT,
        progress_metric TEXT,
        progress_target REAL,
        progress_start REAL,
        progress_period TEXT,
        progress_conversion REAL,
        progress_conversion_base REAL,
        duration_minutes REAL,
        sort_order INTEGER,
        group_id TEXT,
        health_source TEXT
      );
      CREATE INDEX IF NOT EXISTS habits_active_idx ON habits (is_active);
      CREATE INDEX IF NOT EXISTS habits_group_idx ON habits (group_id);
      CREATE INDEX IF NOT EXISTS habits_sort_order_idx ON habits (sort_order);

      CREATE TABLE IF NOT EXISTS completions (
        id TEXT PRIMARY KEY NOT NULL,
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        progress_value REAL,
        duration_actual REAL,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS completions_habit_date_unique ON completions (habit_id, date);
      CREATE INDEX IF NOT EXISTS completions_date_idx ON completions (date);

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT NOT NULL DEFAULT 'all_day',
        start_time TEXT,
        end_time TEXT,
        due_date TEXT,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurrence_rule TEXT,
        surface_days INTEGER NOT NULL DEFAULT 3,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_dates TEXT NOT NULL DEFAULT '[]',
        time_of_day TEXT,
        due_time TEXT,
        group_id TEXT,
        duration_minutes REAL,
        duration_actual REAL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_completed_idx ON events (is_completed);
      CREATE INDEX IF NOT EXISTS events_due_date_idx ON events (due_date);

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        week_start_day INTEGER NOT NULL DEFAULT 1,
        deadline_surface_days INTEGER NOT NULL DEFAULT 3,
        day_start_hour INTEGER NOT NULL DEFAULT 0,
        progress_units TEXT NOT NULL DEFAULT '["mins","hrs"]'
      );

      CREATE TABLE IF NOT EXISTS skips (
        id TEXT PRIMARY KEY NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        date TEXT,
        week_start TEXT,
        week_end TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS skips_day_unique ON skips (item_type, item_id, scope, date) WHERE scope = 'day';
      CREATE UNIQUE INDEX IF NOT EXISTS skips_week_unique ON skips (item_type, item_id, scope, week_start, week_end) WHERE scope = 'week';
      CREATE INDEX IF NOT EXISTS skips_date_idx ON skips (date);
      CREATE INDEX IF NOT EXISTS skips_week_idx ON skips (week_start, week_end);

      CREATE TABLE IF NOT EXISTS vacations (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        is_template INTEGER NOT NULL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        habit_ids TEXT NOT NULL DEFAULT '[]',
        group_ids TEXT NOT NULL DEFAULT '[]',
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS vacations_start_end_idx ON vacations (start_date, end_date);
    `);
  }

  await conn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
