// SQLite version of the web app's Postgres schema (lib/db/schema.ts).
// Column names match Postgres so backups move between the two unchanged.
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { HealthSource, HabitFrequency, ProgressPeriod, SkipItemType, SkipScope, TimeOfDay } from "../types";

const nowIso = () => new Date().toISOString();

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8b5cf6"),
    sortOrder: integer("sort_order"),
  },
  (table) => [index("groups_sort_order_idx").on(table.sortOrder)]
);

export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    frequency: text("frequency").$type<HabitFrequency>().notNull().default("daily"),
    weeklyTarget: real("weekly_target"),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    timeOfDay: text("time_of_day").$type<TimeOfDay>(),
    exactTime: text("exact_time"),
    specificDays: text("specific_days"),
    progressMetric: text("progress_metric"),
    progressTarget: real("progress_target"),
    progressStart: real("progress_start"),
    progressPeriod: text("progress_period").$type<ProgressPeriod>(),
    progressConversion: real("progress_conversion"),
    progressConversionBase: real("progress_conversion_base"),
    durationMinutes: real("duration_minutes"),
    sortOrder: integer("sort_order"),
    groupId: text("group_id"),
    healthSource: text("health_source").$type<HealthSource>(),
  },
  (table) => [
    index("habits_active_idx").on(table.isActive),
    index("habits_group_idx").on(table.groupId),
    index("habits_sort_order_idx").on(table.sortOrder),
  ]
);

export const completions = sqliteTable(
  "completions",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    progressValue: real("progress_value"),
    durationActual: real("duration_actual"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex("completions_habit_date_unique").on(table.habitId, table.date),
    index("completions_date_idx").on(table.date),
  ]
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    eventType: text("event_type").$type<"timed" | "all_day" | "deadline">().notNull().default("all_day"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    dueDate: text("due_date"),
    isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
    recurrenceRule: text("recurrence_rule"),
    surfaceDays: integer("surface_days").notNull().default(3),
    isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
    completedDates: text("completed_dates", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    timeOfDay: text("time_of_day").$type<TimeOfDay>(),
    dueTime: text("due_time"),
    groupId: text("group_id"),
    durationMinutes: real("duration_minutes"),
    durationActual: real("duration_actual"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    index("events_completed_idx").on(table.isCompleted),
    index("events_due_date_idx").on(table.dueDate),
  ]
);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  weekStartDay: integer("week_start_day").notNull().default(1),
  deadlineSurfaceDays: integer("deadline_surface_days").notNull().default(3),
  dayStartHour: integer("day_start_hour").notNull().default(0),
  progressUnits: text("progress_units", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => ["mins", "hrs"]),
});

export const skips = sqliteTable(
  "skips",
  {
    id: text("id").primaryKey(),
    itemType: text("item_type").$type<SkipItemType>().notNull(),
    itemId: text("item_id").notNull(),
    scope: text("scope").$type<SkipScope>().notNull(),
    date: text("date"),
    weekStart: text("week_start"),
    weekEnd: text("week_end"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    index("skips_date_idx").on(table.date),
    index("skips_week_idx").on(table.weekStart, table.weekEnd),
  ]
);

export const vacations = sqliteTable(
  "vacations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
    startDate: text("start_date"),
    endDate: text("end_date"),
    habitIds: text("habit_ids", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    groupIds: text("group_ids", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    note: text("note"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("vacations_start_end_idx").on(table.startDate, table.endDate)]
);
