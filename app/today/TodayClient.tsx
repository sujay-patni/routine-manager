"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import HabitCard from "@/components/HabitCard";
import EventCard from "@/components/EventCard";
import AddItemSheet from "@/components/AddItemSheet";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { TodayEvent } from "@/app/actions/events";

interface Props {
  habits: ProcessedHabit[];
  events: TodayEvent[];
  today: string;
  weekEnd: string;
  dayLabel: string;
}

export default function TodayClient({ habits, events, today, dayLabel }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleHabits = habits.filter((h) => h.show && h.state !== "satisfied");
  const satisfiedHabits = habits.filter((h) => h.state === "satisfied");
  const doneCount = habits.filter((h) => h.completed_today > 0).length + events.filter((e) => e.is_completed).length;
  const totalCount = habits.length + events.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const allDayItems = events.filter((e) => e.event_type === "all_day" || e.event_type === "deadline");
  const timedItems = events.filter((e) => e.event_type === "timed").sort((a, b) => {
    if (!a.start_time || !b.start_time) return 0;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-semibold text-muted-foreground">{dayLabel}</h1>
            <span className="text-sm text-muted-foreground">
              {doneCount}/{totalCount} done
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-lg mx-auto w-full space-y-6">

        {/* Tasks & Deadlines */}
        {allDayItems.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tasks & Deadlines
            </h2>
            <div className="space-y-2">
              {allDayItems.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}

        {/* Habits */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Habits
          </h2>
          {visibleHabits.length === 0 && satisfiedHabits.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No habits yet.{" "}
              <button onClick={() => setSheetOpen(true)} className="text-primary underline">
                Add one
              </button>
            </p>
          )}
          <div className="space-y-2">
            {visibleHabits.map((h) => (
              <HabitCard key={h.id} habit={h} today={today} />
            ))}
          </div>
        </section>

        {/* Timed Events */}
        {timedItems.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Events
            </h2>
            <div className="space-y-2">
              {timedItems.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
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
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:bg-primary/90 active:scale-95 transition-all z-40"
        aria-label="Add item"
      >
        +
      </button>

      <AddItemSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
