CREATE TYPE "public"."event_type" AS ENUM('timed', 'all_day', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."habit_frequency" AS ENUM('daily', 'weekly', 'specific_days_weekly', 'specific_dates_monthly', 'specific_dates_yearly');--> statement-breakpoint
CREATE TYPE "public"."health_source" AS ENUM('steps', 'sleep_minutes', 'distance_meters', 'active_calories');--> statement-breakpoint
CREATE TYPE "public"."progress_period" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."skip_item_type" AS ENUM('habit', 'event');--> statement-breakpoint
CREATE TYPE "public"."skip_scope" AS ENUM('day', 'week');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('morning', 'afternoon', 'evening', 'night');--> statement-breakpoint
CREATE TABLE "allowed_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" text PRIMARY KEY NOT NULL,
	"habit_id" text NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"progress_value" double precision,
	"duration_actual" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" "event_type" DEFAULT 'all_day' NOT NULL,
	"start_time" text,
	"end_time" text,
	"due_date" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"surface_days" integer DEFAULT 3 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_of_day" time_of_day,
	"due_time" text,
	"group_id" text,
	"duration_minutes" double precision,
	"duration_actual" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8b5cf6' NOT NULL,
	"sort_order" integer
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency" "habit_frequency" DEFAULT 'daily' NOT NULL,
	"weekly_target" double precision,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_of_day" time_of_day,
	"exact_time" text,
	"specific_days" text,
	"progress_metric" text,
	"progress_target" double precision,
	"progress_start" double precision,
	"progress_period" "progress_period",
	"progress_conversion" double precision,
	"progress_conversion_base" double precision,
	"duration_minutes" double precision,
	"sort_order" integer,
	"group_id" text,
	"health_source" "health_source"
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"week_start_day" integer DEFAULT 1 NOT NULL,
	"deadline_surface_days" integer DEFAULT 3 NOT NULL,
	"day_start_hour" integer DEFAULT 0 NOT NULL,
	"progress_units" jsonb DEFAULT '["mins","hrs"]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skips" (
	"id" text PRIMARY KEY NOT NULL,
	"item_type" "skip_item_type" NOT NULL,
	"item_id" text NOT NULL,
	"scope" "skip_scope" NOT NULL,
	"date" text,
	"week_start" text,
	"week_end" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"start_date" text,
	"end_date" text,
	"habit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "allowed_devices_device_id_unique" ON "allowed_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "allowed_devices_active_idx" ON "allowed_devices" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "completions_habit_date_unique" ON "completions" USING btree ("habit_id","date");--> statement-breakpoint
CREATE INDEX "completions_date_idx" ON "completions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "completions_habit_idx" ON "completions" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_completed_idx" ON "events" USING btree ("is_completed");--> statement-breakpoint
CREATE INDEX "events_due_date_idx" ON "events" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "events_start_time_idx" ON "events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "events_group_idx" ON "events" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "groups_sort_order_idx" ON "groups" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "habits_active_idx" ON "habits" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "habits_group_idx" ON "habits" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "habits_sort_order_idx" ON "habits" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "habits_health_source_idx" ON "habits" USING btree ("health_source");--> statement-breakpoint
CREATE UNIQUE INDEX "skips_day_unique" ON "skips" USING btree ("item_type","item_id","scope","date") WHERE "skips"."scope" = 'day';--> statement-breakpoint
CREATE UNIQUE INDEX "skips_week_unique" ON "skips" USING btree ("item_type","item_id","scope","week_start","week_end") WHERE "skips"."scope" = 'week';--> statement-breakpoint
CREATE INDEX "skips_date_idx" ON "skips" USING btree ("date");--> statement-breakpoint
CREATE INDEX "skips_week_idx" ON "skips" USING btree ("week_start","week_end");--> statement-breakpoint
CREATE INDEX "skips_item_idx" ON "skips" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "vacations_template_idx" ON "vacations" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "vacations_start_end_idx" ON "vacations" USING btree ("start_date","end_date");