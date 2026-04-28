export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type HabitFrequency =
  | "daily"
  | "weekly"
  | "specific_days_weekly"
  | "specific_dates_monthly"
  | "specific_dates_yearly";
export type ProgressPeriod = "daily" | "weekly" | "monthly" | "yearly";
export type SkipScope = "day" | "week";
export type SkipItemType = "habit" | "event";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  weekly_target: number | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  // scheduling
  time_of_day: TimeOfDay | null;
  exact_time: string | null;      // "HH:MM"
  specific_days: string | null;   // "MO,WE,FR" | "1,15" | "01-15"
  // progress tracking
  progress_metric: string | null; // unit name e.g. "steps", "mins", "hrs"
  progress_target: number | null; // e.g. 10000
  progress_start: number | null;  // e.g. 0
  progress_period: ProgressPeriod | null; // "daily" | "weekly" | "monthly" | "yearly"
  progress_conversion: number | null; // minutes per unit (right/left); null = 1
  progress_conversion_base: number | null; // the left-side quantity (e.g. 1000 for "1000 steps = 10 mins")
  // duration
  duration_minutes: number | null; // default expected time per completion (minutes)
  // display
  sort_order: number | null;
  group_id: string | null;
  skip_id?: string | null;
  is_skipped?: boolean;
  skip_scope?: SkipScope | null;
}

export interface Completion {
  id: string;
  habit_id: string;
  date: string;       // YYYY-MM-DD
  note: string | null;
  progress_value: number | null;
  duration_actual: number | null; // actual time spent in minutes
}

export interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "timed" | "all_day" | "deadline";
  start_time: string | null;   // ISO datetime (timed events)
  end_time: string | null;     // ISO datetime (optional)
  due_date: string | null;     // YYYY-MM-DD
  is_recurring: boolean;
  recurrence_rule: string | null;
  surface_days: number;
  is_completed: boolean;
  // scheduling
  time_of_day: TimeOfDay | null;
  due_time: string | null;       // "HH:MM" for tasks/deadlines
  group_id: string | null;
  // duration
  duration_minutes: number | null; // default expected time (minutes)
  duration_actual: number | null;  // actual time logged at completion (minutes)
  skip_id?: string | null;
  is_skipped?: boolean;
  skip_scope?: SkipScope | null;
}

export interface SkipRecord {
  id: string;
  item_type: SkipItemType;
  item_id: string;
  scope: SkipScope;
  date: string | null;
  week_start: string | null;
  week_end: string | null;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  sort_order: number | null;
}

export interface Vacation {
  id: string;
  name: string;
  is_template: boolean;
  start_date: string | null;  // YYYY-MM-DD; null for templates
  end_date: string | null;    // YYYY-MM-DD; null for templates
  habit_ids: string[];
  group_ids: string[];
  note: string | null;
}

export interface AppSettings {
  id: string;
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
  day_start_hour: number; // 0–23; habits don't reset until this hour (0 = midnight)
  progress_units: string[]; // available units for progress tracking (always includes "mins","hrs")
}
