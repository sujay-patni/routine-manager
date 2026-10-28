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
export type HealthSource = "steps" | "sleep_minutes" | "distance_meters" | "active_calories";

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
  time_of_day: TimeOfDay | null;
  exact_time: string | null;
  specific_days: string | null;
  progress_metric: string | null;
  progress_target: number | null;
  progress_start: number | null;
  progress_period: ProgressPeriod | null;
  progress_conversion: number | null;
  progress_conversion_base: number | null;
  duration_minutes: number | null;
  sort_order: number | null;
  group_id: string | null;
  health_source: HealthSource | null;
  skip_id?: string | null;
  is_skipped?: boolean;
  skip_scope?: SkipScope | null;
}

export interface Completion {
  id: string;
  habit_id: string;
  date: string;
  note: string | null;
  progress_value: number | null;
  duration_actual: number | null;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "timed" | "all_day" | "deadline";
  start_time: string | null;
  end_time: string | null;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  surface_days: number;
  is_completed: boolean;
  completed_dates: string[];
  time_of_day: TimeOfDay | null;
  due_time: string | null;
  group_id: string | null;
  duration_minutes: number | null;
  duration_actual: number | null;
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
  start_date: string | null;
  end_date: string | null;
  habit_ids: string[];
  group_ids: string[];
  note: string | null;
}

export interface AppSettings {
  id: string;
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
  day_start_hour: number;
  progress_units: string[];
}
