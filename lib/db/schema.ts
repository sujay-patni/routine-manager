import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { HealthSource, HabitFrequency, ProgressPeriod, SkipItemType, SkipScope, TimeOfDay } from "../domain/types";

export const habitFrequencyEnum = pgEnum("habit_frequency", [
  "daily",
  "weekly",
  "specific_days_weekly",
  "specific_dates_monthly",
  "specific_dates_yearly",
]);

export const progressPeriodEnum = pgEnum("progress_period", ["daily", "weekly", "monthly", "yearly"]);
export const timeOfDayEnum = pgEnum("time_of_day", ["morning", "afternoon", "evening", "night"]);
export const eventTypeEnum = pgEnum("event_type", ["timed", "all_day", "deadline"]);
export const skipItemTypeEnum = pgEnum("skip_item_type", ["habit", "event"]);
export const skipScopeEnum = pgEnum("skip_scope", ["day", "week"]);
export const healthSourceEnum = pgEnum("health_source", [
  "steps",
  "sleep_minutes",
  "distance_meters",
  "active_calories",
]);

export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8b5cf6"),
    sortOrder: integer("sort_order"),
  },
  (table) => [
    index("groups_sort_order_idx").on(table.sortOrder),
  ]
);

export const habits = pgTable(
  "habits",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    frequency: habitFrequencyEnum("frequency").$type<HabitFrequency>().notNull().default("daily"),
    weeklyTarget: doublePrecision("weekly_target"),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    timeOfDay: timeOfDayEnum("time_of_day").$type<TimeOfDay>(),
    exactTime: text("exact_time"),
    specificDays: text("specific_days"),
    progressMetric: text("progress_metric"),
    progressTarget: doublePrecision("progress_target"),
    progressStart: doublePrecision("progress_start"),
    progressPeriod: progressPeriodEnum("progress_period").$type<ProgressPeriod>(),
    progressConversion: doublePrecision("progress_conversion"),
    progressConversionBase: doublePrecision("progress_conversion_base"),
    durationMinutes: doublePrecision("duration_minutes"),
    sortOrder: integer("sort_order"),
    groupId: text("group_id"),
    healthSource: healthSourceEnum("health_source").$type<HealthSource>(),
  },
  (table) => [
    index("habits_active_idx").on(table.isActive),
    index("habits_group_idx").on(table.groupId),
    index("habits_sort_order_idx").on(table.sortOrder),
    index("habits_health_source_idx").on(table.healthSource),
  ]
);

export const completions = pgTable(
  "completions",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    progressValue: doublePrecision("progress_value"),
    durationActual: doublePrecision("duration_actual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("completions_habit_date_unique").on(table.habitId, table.date),
    index("completions_date_idx").on(table.date),
    index("completions_habit_idx").on(table.habitId),
  ]
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    eventType: eventTypeEnum("event_type").notNull().default("all_day"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    dueDate: text("due_date"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurrenceRule: text("recurrence_rule"),
    surfaceDays: integer("surface_days").notNull().default(3),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedDates: jsonb("completed_dates").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    timeOfDay: timeOfDayEnum("time_of_day").$type<TimeOfDay>(),
    dueTime: text("due_time"),
    groupId: text("group_id"),
    durationMinutes: doublePrecision("duration_minutes"),
    durationActual: doublePrecision("duration_actual"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("events_type_idx").on(table.eventType),
    index("events_completed_idx").on(table.isCompleted),
    index("events_due_date_idx").on(table.dueDate),
    index("events_start_time_idx").on(table.startTime),
    index("events_group_idx").on(table.groupId),
  ]
);

export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  weekStartDay: integer("week_start_day").notNull().default(1),
  deadlineSurfaceDays: integer("deadline_surface_days").notNull().default(3),
  dayStartHour: integer("day_start_hour").notNull().default(0),
  progressUnits: jsonb("progress_units").$type<string[]>().notNull().default(sql`'["mins","hrs"]'::jsonb`),
});

export const skips = pgTable(
  "skips",
  {
    id: text("id").primaryKey(),
    itemType: skipItemTypeEnum("item_type").$type<SkipItemType>().notNull(),
    itemId: text("item_id").notNull(),
    scope: skipScopeEnum("scope").$type<SkipScope>().notNull(),
    date: text("date"),
    weekStart: text("week_start"),
    weekEnd: text("week_end"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("skips_day_unique")
      .on(table.itemType, table.itemId, table.scope, table.date)
      .where(sql`${table.scope} = 'day'`),
    uniqueIndex("skips_week_unique")
      .on(table.itemType, table.itemId, table.scope, table.weekStart, table.weekEnd)
      .where(sql`${table.scope} = 'week'`),
    index("skips_date_idx").on(table.date),
    index("skips_week_idx").on(table.weekStart, table.weekEnd),
    index("skips_item_idx").on(table.itemType, table.itemId),
  ]
);

export const vacations = pgTable(
  "vacations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isTemplate: boolean("is_template").notNull().default(false),
    startDate: text("start_date"),
    endDate: text("end_date"),
    habitIds: jsonb("habit_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    groupIds: jsonb("group_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("vacations_template_idx").on(table.isTemplate),
    index("vacations_start_end_idx").on(table.startDate, table.endDate),
  ]
);

export const allowedDevices = pgTable(
  "allowed_devices",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    name: text("name"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("allowed_devices_device_id_unique").on(table.deviceId),
    index("allowed_devices_active_idx").on(table.isActive),
  ]
);
