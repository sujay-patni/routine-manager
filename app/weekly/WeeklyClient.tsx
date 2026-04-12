"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO, eachDayOfInterval } from "date-fns";

interface HabitSummary {
  id: string;
  name: string;
  frequency: string;
  weekly_target: number | null;
  color: string;
  icon: string;
  completions_this_week: number;
  completions_by_date: string[];
}

interface Props {
  habits: HabitSummary[];
  weekStart: string;
  weekEnd: string;
  timezone: string;
}

export default function WeeklyClient({ habits, weekStart, weekEnd }: Props) {
  const weekDays = weekStart && weekEnd
    ? eachDayOfInterval({ start: parseISO(weekStart), end: parseISO(weekEnd) })
    : [];

  const totalHabits = habits.length;
  const fullyComplete = habits.filter((h) => {
    const target = h.frequency === "daily" ? 7 : (h.weekly_target ?? 1);
    return Number(h.completions_this_week) >= target;
  }).length;

  const weekLabel = weekStart && weekEnd
    ? `${format(parseISO(weekStart), "MMM d")} – ${format(parseISO(weekEnd), "MMM d")}`
    : "";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">This Week</h1>
            <span className="text-sm text-muted-foreground">{weekLabel}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-lg mx-auto w-full space-y-6">

        {/* Overview */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-1">Habits on track</p>
          <p className="text-3xl font-bold">{fullyComplete}<span className="text-lg text-muted-foreground font-normal">/{totalHabits}</span></p>
          <Progress value={totalHabits > 0 ? (fullyComplete / totalHabits) * 100 : 0} className="mt-2 h-2" />
        </div>

        {/* Day header */}
        {weekDays.length > 0 && (
          <div className="grid grid-cols-[1fr_repeat(7,_2rem)] gap-1 items-center">
            <div />
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="text-center text-xs text-muted-foreground font-medium">
                {format(d, "EEE")[0]}
              </div>
            ))}
          </div>
        )}

        {/* Habits */}
        {habits.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No habits tracked this week.</p>
        )}

        {habits.map((habit) => {
          const target = habit.frequency === "daily" ? 7 : (habit.weekly_target ?? 1);
          const done = Number(habit.completions_this_week);
          const pct = Math.min(100, Math.round((done / target) * 100));
          const completedSet = new Set(habit.completions_by_date);

          return (
            <div key={habit.id} className="space-y-2">
              <div className="grid grid-cols-[1fr_repeat(7,_2rem)] gap-1 items-center">
                {/* Habit name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="text-sm font-medium truncate">{habit.icon} {habit.name}</span>
                </div>
                {/* Day dots */}
                {weekDays.map((d) => {
                  const dayStr = format(d, "yyyy-MM-dd");
                  const completed = completedSet.has(dayStr);
                  return (
                    <div
                      key={dayStr}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center mx-auto",
                        completed ? "text-white" : "bg-muted"
                      )}
                      style={completed ? { backgroundColor: habit.color } : {}}
                    >
                      {completed && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <Progress value={pct} className="flex-1 h-1.5" />
                <span className="text-xs text-muted-foreground flex-shrink-0 w-12 text-right">
                  {done}/{target}
                </span>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
