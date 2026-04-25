export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type HabitFrequency =
  | "daily"
  | "weekly"
  | "specific_days_weekly"
  | "specific_dates_monthly"
  | "specific_dates_yearly";
export type ProgressPeriod = "daily" | "weekly" | "monthly" | "yearly";

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
  progress_metric: string | null; // e.g. "steps"
  progress_target: number | null; // e.g. 10000
  progress_start: number | null;  // e.g. 0
  progress_period: ProgressPeriod | null; // "daily" | "weekly" | "monthly" | "yearly"
  // display
  sort_order: number | null;
  group_id: string | null;
}

export interface Completion {
  id: string;
  habit_id: string;
  date: string;       // YYYY-MM-DD
  note: string | null;
  progress_value: number | null;
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
}

export interface Group {
  id: string;
  name: string;
  color: string;
  sort_order: number | null;
}

export interface AppSettings {
  id: string;
  timezone: string;
  week_start_day: number;
  deadline_surface_days: number;
  day_start_hour: number; // 0–23; habits don't reset until this hour (0 = midnight)
}
