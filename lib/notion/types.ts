export interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly";
  weekly_target: number | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface Completion {
  id: string;
  habit_id: string;
  date: string;       // YYYY-MM-DD
  note: string | null;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "timed" | "all_day" | "deadline";
  start_time: string | null;   // ISO datetime
  end_time: string | null;     // ISO datetime
  due_date: string | null;     // YYYY-MM-DD
  is_recurring: boolean;
  recurrence_rule: string | null;
  surface_days: number;
  is_completed: boolean;
}

// Shape expected by lib/habit-logic.ts processHabits()
export interface HabitWithCounts extends Habit {
  completions_this_week: number;
  completed_today: number;
}
