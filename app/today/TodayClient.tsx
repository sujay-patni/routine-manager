"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import HabitCard from "@/components/HabitCard";
import EventCard from "@/components/EventCard";
import AddItemSheet from "@/components/AddItemSheet";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { TodayEvent } from "@/app/actions/events";
import { format, addDays, subDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  habits: ProcessedHabit[];
  events: TodayEvent[];
  today: string;
  weekEnd: string;
  dayLabel: string;
  relativeLabel: string;
  dateStr: string;
}

const TIME_OF_DAY_RANGES: Record<string, { label: string; icon: string; start: number; end: number }> = {
  morning:   { label: "Morning",   icon: "🌅", start: 6,  end: 12 },
  afternoon: { label: "Afternoon", icon: "☀️",  start: 12, end: 17 },
  evening:   { label: "Evening",   icon: "🌆", start: 17, end: 21 },
  night:     { label: "Night",     icon: "🌙", start: 21, end: 6  },
};

function getItemTimeMinutes(event: TodayEvent): number | null {
  if (event.event_type === "timed" && event.start_time) {
    const d = new Date(event.start_time);
    return d.getHours() * 60 + d.getMinutes();
  }
  if (event.due_time) {
    const [h, m] = event.due_time.split(":").map(Number);
    return h * 60 + m;
  }
  if (event.time_of_day) {
    const ranges = TIME_OF_DAY_RANGES[event.time_of_day];
    if (ranges) return ranges.start * 60;
  }
  return null;
}

function getHabitTimeMinutes(habit: ProcessedHabit): number | null {
  if (habit.exact_time) {
    const [h, m] = habit.exact_time.split(":").map(Number);
    return h * 60 + m;
  }
  if (habit.time_of_day) {
    const range = TIME_OF_DAY_RANGES[habit.time_of_day];
    return range ? range.start * 60 : null;
  }
  return null;
}

export default function TodayClient({
  habits,
  events,
  today,
  dayLabel,
  relativeLabel,
  dateStr,
}: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const navigate = useCallback((direction: "prev" | "next") => {
    const base = parseISO(dateStr);
    const target = direction === "prev" ? subDays(base, 1) : addDays(base, 1);
    const newDate = format(target, "yyyy-MM-dd");
    const todayDate = format(new Date(), "yyyy-MM-dd");
    if (newDate === todayDate) {
      router.push("/today");
    } else {
      router.push(`/today?date=${newDate}`);
    }
  }, [dateStr, router]);

  const visibleEvents = events.filter((e) => !removedIds.has(e.id));
  const visibleHabits = habits.filter((h) => h.show && h.state !== "satisfied");
  const satisfiedHabits = habits.filter((h) => h.state === "satisfied");

  const doneCount =
    habits.filter((h) => h.completed_today > 0).length +
    visibleEvents.filter((e) => e.is_completed).length;
  const totalCount = habits.length + visibleEvents.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Separate timed events with exact times from those without
  const timedWithTime = visibleEvents
    .filter((e) => e.event_type === "timed" && e.start_time)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const allDayItems = visibleEvents.filter(
    (e) => e.event_type === "all_day" || e.event_type === "deadline"
  );

  // Group habits and tasks by time of day for sections
  const habitsWithTime = visibleHabits.filter((h) => h.exact_time || h.time_of_day);
  const habitsNoTime = visibleHabits.filter((h) => !h.exact_time && !h.time_of_day);
  const tasksNoTime = allDayItems.filter((e) => !e.due_time && !e.time_of_day);
  const tasksWithTime = allDayItems.filter((e) => e.due_time || e.time_of_day);

  // Build a merged timetable for timed events + habits with exact times
  type TimedEntry =
    | { kind: "event"; item: TodayEvent; minutes: number }
    | { kind: "habit"; item: ProcessedHabit; minutes: number };

  const timedEntries: TimedEntry[] = [
    ...timedWithTime.map((e) => ({ kind: "event" as const, item: e, minutes: getItemTimeMinutes(e) ?? 0 })),
    ...habitsWithTime.map((h) => ({ kind: "habit" as const, item: h, minutes: getHabitTimeMinutes(h) ?? 0 })),
    ...tasksWithTime.map((e) => ({ kind: "event" as const, item: e, minutes: getItemTimeMinutes(e) ?? 0 })),
  ].sort((a, b) => a.minutes - b.minutes);

  const hasTimetable = timedEntries.length > 0;
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto lg:max-w-none">
          <div className="flex items-center justify-between mb-2">
            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("prev")}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Previous day"
              >
                ‹
              </button>
              <div className="text-center">
                <h1 className={cn(
                  "text-sm font-semibold",
                  relativeLabel === "Today" ? "text-primary" : "text-foreground"
                )}>
                  {relativeLabel}
                </h1>
                {relativeLabel !== "Today" && relativeLabel !== dayLabel && (
                  <p className="text-xs text-muted-foreground">{dayLabel}</p>
                )}
              </div>
              <button
                onClick={() => navigate("next")}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Next day"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isToday && (
                <button
                  onClick={() => router.push("/today")}
                  className="text-xs text-primary font-medium"
                >
                  Go to today
                </button>
              )}
              <span className="text-sm text-muted-foreground">{doneCount}/{totalCount} done</span>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full lg:max-w-none space-y-6">

        {/* Tasks & Deadlines (no time) */}
        {tasksNoTime.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tasks & Deadlines
            </h2>
            <div className="space-y-2">
              {tasksNoTime.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onRemove={(id) => setRemovedIds((prev) => new Set([...prev, id]))}
                />
              ))}
            </div>
          </section>
        )}

        {/* Habits without time */}
        {habitsNoTime.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Habits
            </h2>
            <div className="space-y-2">
              {habitsNoTime.map((h) => (
                <HabitCard key={h.id} habit={h} today={today} />
              ))}
            </div>
          </section>
        )}

        {/* Timetable — merged timed entries with current time indicator */}
        {hasTimetable && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Schedule
            </h2>
            <div className="space-y-2">
              {timedEntries.map((entry, idx) => {
                // Show current time indicator before this entry if time has passed threshold
                const prevMinutes = idx > 0 ? timedEntries[idx - 1].minutes : -1;
                const showIndicator =
                  isToday &&
                  currentMinutes >= prevMinutes &&
                  currentMinutes < entry.minutes;

                return (
                  <div key={entry.kind === "event" ? entry.item.id : `h-${entry.item.id}`}>
                    {showIndicator && (
                      <div className="flex items-center gap-2 py-1 my-1">
                        <div className="flex-1 h-px bg-red-400" />
                        <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                          {(() => {
                            const h = Math.floor(currentMinutes / 60);
                            const m = currentMinutes % 60;
                            const ampm = h >= 12 ? "PM" : "AM";
                            const hour = h % 12 || 12;
                            return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
                          })()}
                        </span>
                        <div className="flex-1 h-px bg-red-400" />
                      </div>
                    )}
                    <div className={cn(
                      isToday && entry.minutes < currentMinutes && "opacity-60"
                    )}>
                      {entry.kind === "event" ? (
                        <EventCard
                          event={entry.item as TodayEvent}
                          onRemove={(id) => setRemovedIds((prev) => new Set([...prev, id]))}
                        />
                      ) : (
                        <HabitCard habit={entry.item as ProcessedHabit} today={today} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Current time indicator at end (if after all items) */}
              {isToday && timedEntries.length > 0 &&
                currentMinutes >= timedEntries[timedEntries.length - 1].minutes && (
                  <div className="flex items-center gap-2 py-1 my-1">
                    <div className="flex-1 h-px bg-red-400" />
                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                      {(() => {
                        const h = Math.floor(currentMinutes / 60);
                        const m = currentMinutes % 60;
                        const ampm = h >= 12 ? "PM" : "AM";
                        const hour = h % 12 || 12;
                        return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
                      })()}
                    </span>
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}
            </div>
          </section>
        )}

        {/* Satisfied weekly habits */}
        {satisfiedHabits.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Weekly goals met ✓
            </h2>
            <div className="space-y-2">
              {satisfiedHabits.map((h) => (
                <HabitCard key={h.id} habit={h} today={today} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">🌟</p>
            <p className="text-lg font-semibold">Build your routine</p>
            <p className="text-sm text-muted-foreground">Add habits, tasks, and events to get started.</p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:bg-primary/90 active:scale-95 transition-all z-40"
        aria-label="Add item"
      >
        +
      </button>

      <AddItemSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
