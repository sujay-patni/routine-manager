"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { updateHabit, getAllHabits } from "@/app/actions/habits";
import { saveSettings } from "@/app/actions/settings";
import AddItemSheet from "@/components/AddItemSheet";
import type { Habit } from "@/lib/notion/types";
import type { AppSettings } from "@/app/actions/settings";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

interface Props {
  settings: AppSettings;
  habits: Habit[];
  notionHabitsUrl?: string;
  notionEventsUrl?: string;
}

export default function SettingsClient({ settings, habits: initialHabits, notionHabitsUrl, notionEventsUrl }: Props) {
  const router = useRouter();
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [habits, setHabits] = useState(initialHabits);

  // Settings form state
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStart, setWeekStart] = useState(String(settings.week_start_day));
  const [surfaceDays, setSurfaceDays] = useState(String(settings.deadline_surface_days));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const notionEnabled = settings.id !== "env";

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    const result = await saveSettings({
      timezone,
      week_start_day: Number(weekStart),
      deadline_surface_days: Number(surfaceDays),
    });
    setSavingSettings(false);
    if (!result.error) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
      router.refresh();
    }
  }

  async function toggleHabitActive(habit: Habit) {
    await updateHabit(habit.id, { is_active: !habit.is_active });
    setHabits((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, is_active: !h.is_active } : h))
    );
    router.refresh();
  }

  async function handleHabitAdded() {
    const updated = await getAllHabits();
    setHabits(updated);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto lg:max-w-none">
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full lg:max-w-none space-y-8">

        {/* ─── Preferences ─── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferences</h2>

          {!notionEnabled && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <strong>Tip:</strong> To save settings in-app, add a <code className="bg-muted px-1 rounded">NOTION_SETTINGS_DB_ID</code> env var pointing to a Notion database with <em>Timezone</em>, <em>Week Start Day</em>, and <em>Deadline Surface Days</em> fields. Until then, changes here won&apos;t persist across deploys.
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="rounded-2xl border bg-card card-elevated p-4 space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => v != null && setTimezone(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Week starts on</Label>
              <Select value={weekStart} onValueChange={(v) => v != null && setWeekStart(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Show deadlines starting{" "}
                <span className="text-muted-foreground font-normal">— days before due date</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={surfaceDays}
                onChange={(e) => setSurfaceDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A deadline with &ldquo;3 days&rdquo; will appear in your Today view starting 3 days before it&apos;s due.
              </p>
            </div>

            <Button type="submit" disabled={savingSettings} className="w-full">
              {savingSettings ? "Saving…" : settingsSaved ? "Saved ✓" : "Save preferences"}
            </Button>
          </form>
        </section>

        <Separator />

        {/* ─── Habits ─── */}
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
                className="flex items-center gap-3 p-3 rounded-2xl border bg-card card-elevated"
                style={{ borderLeftWidth: "4px", borderLeftColor: habit.color }}
              >
                <span className="text-xl">{habit.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{habit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {habit.frequency === "daily"
                      ? "Daily"
                      : habit.frequency === "weekly"
                      ? `${habit.weekly_target}× per week`
                      : habit.frequency === "specific_days_weekly"
                      ? `${habit.specific_days ?? "custom"} weekly`
                      : habit.frequency === "specific_dates_monthly"
                      ? "Monthly"
                      : "Yearly"}
                    {habit.progress_metric ? ` · ${habit.progress_target} ${habit.progress_metric}` : ""}
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

        <Separator />

        {/* ─── Notion Export ─── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Data & Export</h2>
          <div className="rounded-2xl border bg-card card-elevated p-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              All your habits, completions, events, and history live directly in your Notion workspace. You can view, filter, and export them at any time.
            </p>
            <div className="flex flex-wrap gap-2">
              {notionHabitsUrl && (
                <a
                  href={notionHabitsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                >
                  <span>📋</span> Open Habits in Notion
                </a>
              )}
              {notionEventsUrl && (
                <a
                  href={notionEventsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                >
                  <span>📅</span> Open Events in Notion
                </a>
              )}
              {!notionHabitsUrl && !notionEventsUrl && (
                <p className="text-xs text-muted-foreground">
                  Open <a href="https://notion.so" target="_blank" rel="noopener noreferrer" className="text-primary underline">notion.so</a> and find your Routine databases.
                </p>
              )}
            </div>
          </div>
        </section>

      </main>

      <AddItemSheet
        open={addHabitOpen}
        onOpenChange={(o) => {
          setAddHabitOpen(o);
          if (!o) handleHabitAdded();
        }}
        defaultTab="habit"
      />
    </div>
  );
}
