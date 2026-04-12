"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { updateHabit } from "@/app/actions/habits";
import AddItemSheet from "@/components/AddItemSheet";
import type { Habit } from "@/lib/notion/types";
import type { AppSettings } from "@/app/actions/settings";

interface Props {
  settings: AppSettings;
  habits: Habit[];
}

export default function SettingsClient({ settings, habits: initialHabits }: Props) {
  const router = useRouter();
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [habits, setHabits] = useState(initialHabits);

  async function toggleHabitActive(habit: Habit) {
    await updateHabit(habit.id, { is_active: !habit.is_active });
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, is_active: !h.is_active } : h))
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-lg mx-auto w-full space-y-8">

        {/* App Preferences (read-only) */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferences</h2>
          <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{settings.timezone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Week starts on</span>
              <span className="font-medium">{settings.week_start_day === 1 ? "Monday" : "Sunday"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Surface deadlines</span>
              <span className="font-medium">{settings.deadline_surface_days} days early</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            To change these values, update the <code className="bg-muted px-1 rounded">TIMEZONE</code>,{" "}
            <code className="bg-muted px-1 rounded">WEEK_START_DAY</code>, and{" "}
            <code className="bg-muted px-1 rounded">DEADLINE_SURFACE_DAYS</code> environment variables and redeploy.
          </p>
        </section>

        <Separator />

        {/* Habits */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Habits</h2>
            <Button size="sm" variant="outline" onClick={() => setAddHabitOpen(true)}>
              + Add habit
            </Button>
          </div>

          {habits.length === 0 && (
            <p className="text-sm text-muted-foreground">No habits yet. Add your first one!</p>
          )}

          <div className="space-y-2">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card"
                style={{ borderLeftWidth: "4px", borderLeftColor: habit.color }}
              >
                <span className="text-xl">{habit.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{habit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {habit.frequency === "daily"
                      ? "Every day"
                      : `${habit.weekly_target}x per week`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={habit.is_active ? "outline" : "secondary"}
                  onClick={() => toggleHabitActive(habit)}
                  className="text-xs"
                >
                  {habit.is_active ? "Pause" : "Resume"}
                </Button>
              </div>
            ))}
          </div>
        </section>

      </main>

      <AddItemSheet open={addHabitOpen} onOpenChange={setAddHabitOpen} defaultTab="habit" />
    </div>
  );
}
