"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { updateHabit, getAllHabits, reorderHabits } from "@/app/actions/habits";
import { saveSettings } from "@/app/actions/settings";
import AddItemSheet from "@/components/AddItemSheet";
import EditHabitSheet from "@/components/EditHabitSheet";
import { useSettings } from "@/components/SettingsProvider";
import type { Habit } from "@/lib/notion/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/useTheme";

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

type SectionKey = "morning" | "afternoon" | "evening" | "night" | "all_day";

const SECTION_LABELS: Record<SectionKey, string> = {
  morning: "🌅 Morning",
  afternoon: "☀️ Afternoon",
  evening: "🌆 Evening",
  night: "🌙 Night",
  all_day: "🗓 All Day",
};

const SECTION_ORDER: SectionKey[] = ["morning", "afternoon", "evening", "night", "all_day"];

function getHabitSection(habit: Habit): SectionKey {
  if (habit.time_of_day) return habit.time_of_day as SectionKey;
  if (habit.exact_time) {
    const h = parseInt(habit.exact_time.split(":")[0], 10);
    if (h >= 4 && h < 12) return "morning";
    if (h >= 12 && h < 16) return "afternoon";
    if (h >= 16 && h < 20) return "evening";
    return "night";
  }
  return "all_day";
}

interface Props {
  habits: Habit[];
  notionHabitsUrl?: string;
  notionEventsUrl?: string;
  notionSettingsConfigured?: boolean;
}

export default function SettingsClient({ habits: initialHabits, notionHabitsUrl, notionEventsUrl, notionSettingsConfigured }: Props) {
  const settings = useSettings();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habits, setHabits] = useState(initialHabits);

  // Ordered habit IDs per section (for client-side reordering)
  const [sectionOrder, setSectionOrder] = useState<Record<SectionKey, string[]>>(() => {
    const groups: Record<SectionKey, Habit[]> = {
      morning: [], afternoon: [], evening: [], night: [], all_day: [],
    };
    for (const h of initialHabits) {
      groups[getHabitSection(h)].push(h);
    }
    const result = {} as Record<SectionKey, string[]>;
    for (const key of SECTION_ORDER) {
      result[key] = groups[key]
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
        .map(h => h.id);
    }
    return result;
  });

  // Settings form state
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStart, setWeekStart] = useState(String(settings.week_start_day));
  const [surfaceDays, setSurfaceDays] = useState(String(settings.deadline_surface_days));
  const [dayStartHour, setDayStartHour] = useState(String(settings.day_start_hour));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const { theme, setTheme } = useTheme();

  // Progress units state
  const [progressUnits, setProgressUnits] = useState(settings.progress_units ?? ["mins", "hrs"]);
  const [newUnit, setNewUnit] = useState("");
  const FIXED_UNITS = ["mins", "hrs"];

  const notionEnabled = notionSettingsConfigured === true || settings.id !== "env";

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    const result = await saveSettings({
      timezone,
      week_start_day: Number(weekStart),
      deadline_surface_days: Number(surfaceDays),
      day_start_hour: Number(dayStartHour),
      progress_units: progressUnits,
    });
    setSavingSettings(false);
    if (!result.error) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
      router.refresh();
    }
  }

  function currentBaseSettings() {
    return {
      timezone,
      week_start_day: Number(weekStart),
      deadline_surface_days: Number(surfaceDays),
      day_start_hour: Number(dayStartHour),
    };
  }

  async function addProgressUnit() {
    const unit = newUnit.trim().toLowerCase();
    if (!unit || progressUnits.includes(unit)) { setNewUnit(""); return; }
    const updated = [...progressUnits, unit];
    setProgressUnits(updated);
    setNewUnit("");
    const result = await saveSettings({ ...currentBaseSettings(), progress_units: updated });
    if (result.error) {
      console.error("Failed to save progress unit:", result.error);
      setProgressUnits(progressUnits); // revert
    } else {
      router.refresh();
    }
  }

  async function removeProgressUnit(unit: string) {
    if (FIXED_UNITS.includes(unit)) return;
    const updated = progressUnits.filter(u => u !== unit);
    setProgressUnits(updated);
    const result = await saveSettings({ ...currentBaseSettings(), progress_units: updated });
    if (result.error) {
      console.error("Failed to remove progress unit:", result.error);
      setProgressUnits(progressUnits); // revert
    } else {
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
    // Rebuild section order with new habits at the end of their section
    setSectionOrder(prev => {
      const existingIds = new Set(Object.values(prev).flat());
      const newGroups = { ...prev };
      for (const h of updated) {
        if (!existingIds.has(h.id)) {
          const sec = getHabitSection(h);
          newGroups[sec] = [...newGroups[sec], h.id];
        }
      }
      return newGroups;
    });
  }

  async function handleHabitUpdated() {
    const updated = await getAllHabits();
    setHabits(updated);
    const groups: Record<SectionKey, Habit[]> = { morning: [], afternoon: [], evening: [], night: [], all_day: [] };
    for (const h of updated) groups[getHabitSection(h)].push(h);
    const newOrder = {} as Record<SectionKey, string[]>;
    for (const key of SECTION_ORDER) {
      newOrder[key] = groups[key].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999)).map(h => h.id);
    }
    setSectionOrder(newOrder);
  }

  function moveHabit(sectionKey: SectionKey, index: number, direction: "up" | "down") {
    const ids = sectionOrder[sectionKey];
    const newIds = [...ids];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newIds.length) return;
    [newIds[index], newIds[swapIdx]] = [newIds[swapIdx], newIds[index]];
    setSectionOrder(prev => ({ ...prev, [sectionKey]: newIds }));
    startTransition(async () => {
      const result = await reorderHabits(newIds);
      if (result.error) {
        console.error("Failed to save order:", result.error);
        // Revert optimistic update
        setSectionOrder(prev => ({ ...prev, [sectionKey]: ids }));
      }
    });
  }

  const habitById = new Map(habits.map(h => [h.id, h]));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-fraunces font-normal text-[28px] tracking-tight leading-tight">Settings</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full space-y-8">

        {/* ─── Preferences ─── */}
        <section className="space-y-4">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Preferences</h2>

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

            <div className="flex items-center justify-between py-1">
              <Label className="font-medium text-[13px]">Theme</Label>
              <div className="inline-flex bg-muted rounded-xl p-0.5 gap-0.5">
                {([["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTheme(v)}
                    className={cn(
                      "px-3 py-1 rounded-[10px] text-[11px] font-medium transition-all",
                      theme === v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="font-medium text-[13px]">Week starts on</Label>
              <div className="inline-flex bg-muted rounded-xl p-0.5 gap-0.5">
                {[{ v: "1", l: "Monday" }, { v: "0", l: "Sunday" }].map(({ v, l }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setWeekStart(v)}
                    className={cn(
                      "px-3 py-1 rounded-[10px] text-[11px] font-medium transition-all",
                      weekStart === v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-1">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium text-[13px]">Show deadlines</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{surfaceDays} days before due date</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurfaceDays(String(Math.max(0, Number(surfaceDays) - 1)))}
                    className="w-7 h-7 rounded-lg border flex items-center justify-center text-foreground text-base font-medium hover:bg-muted transition-colors"
                  >−</button>
                  <span className="text-sm font-semibold min-w-[1.5rem] text-center">{surfaceDays}</span>
                  <button
                    type="button"
                    onClick={() => setSurfaceDays(String(Math.min(30, Number(surfaceDays) + 1)))}
                    className="w-7 h-7 rounded-lg border flex items-center justify-center text-foreground text-base font-medium hover:bg-muted transition-colors"
                  >+</button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A deadline with &ldquo;3 days&rdquo; will appear in your Today view starting 3 days before it&apos;s due.
              </p>
            </div>

            <div className="py-1">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium text-[13px]">Day starts at</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {Number(dayStartHour) === 0 ? "Midnight (default)" : `${dayStartHour}:00 AM`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDayStartHour(String(Math.max(0, Number(dayStartHour) - 1)))}
                    className="w-7 h-7 rounded-lg border flex items-center justify-center text-foreground text-base font-medium hover:bg-muted transition-colors"
                  >−</button>
                  <span className="text-sm font-semibold min-w-[1.5rem] text-center">{dayStartHour}</span>
                  <button
                    type="button"
                    onClick={() => setDayStartHour(String(Math.min(11, Number(dayStartHour) + 1)))}
                    className="w-7 h-7 rounded-lg border flex items-center justify-center text-foreground text-base font-medium hover:bg-muted transition-colors"
                  >+</button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Habits won&apos;t reset until this hour. Between midnight and this time, yesterday&apos;s habits stay active.
              </p>
            </div>

            <Button type="submit" disabled={savingSettings} className="w-full">
              {savingSettings ? "Saving…" : settingsSaved ? "Saved ✓" : "Save preferences"}
            </Button>
          </form>
        </section>

        <Separator />

        {/* ─── Progress Units ─── */}
        <section className="space-y-4">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Progress Units</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Units used when tracking habit progress. <strong>mins</strong> and <strong>hrs</strong> are built-in time units — the progress value IS the time. Custom units can have a conversion rate set per-habit.
          </p>
          <div className="rounded-2xl border bg-card card-elevated p-4 space-y-4">
            {!notionEnabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Custom units require <code className="bg-muted px-1 rounded">NOTION_SETTINGS_DB_ID</code> to persist across reloads.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {progressUnits.map(unit => (
                <span
                  key={unit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-muted"
                >
                  {unit}
                  {notionEnabled && !FIXED_UNITS.includes(unit) && (
                    <button
                      type="button"
                      onClick={() => removeProgressUnit(unit)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${unit}`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
            </div>
            {notionEnabled && (
              <form
                onSubmit={(e) => { e.preventDefault(); addProgressUnit(); }}
                className="flex gap-2"
              >
                <Input
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  placeholder="e.g. pages, reps, km"
                  className="flex-1"
                />
                <Button type="submit" variant="outline" size="sm">Add</Button>
              </form>
            )}
          </div>
        </section>

        <Separator />

        {/* ─── Habits ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Habits</h2>
            <Button size="sm" variant="outline" onClick={() => setAddHabitOpen(true)}>
              + Add habit
            </Button>
          </div>

          {habits.length === 0 && (
            <p className="text-sm text-muted-foreground">No habits yet. Add your first one!</p>
          )}

          {SECTION_ORDER.map((sectionKey) => {
            const ids = sectionOrder[sectionKey];
            const sectionHabits = ids.map(id => habitById.get(id)).filter(Boolean) as Habit[];
            if (sectionHabits.length === 0) return null;

            return (
              <div key={sectionKey} className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {SECTION_LABELS[sectionKey]}
                </h3>
                <div className="space-y-1">
                  {sectionHabits.map((habit, idx) => (
                    <div
                      key={habit.id}
                      className="flex items-center gap-2 p-3 rounded-2xl border bg-card card-elevated"
                    >
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveHabit(sectionKey, idx, "up")}
                          disabled={idx === 0}
                          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          aria-label="Move up"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHabit(sectionKey, idx, "down")}
                          disabled={idx === sectionHabits.length - 1}
                          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          aria-label="Move down"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Habit info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{habit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {habit.frequency === "daily"
                            ? "Daily"
                            : habit.frequency === "weekly"
                            ? `${habit.weekly_target ?? 1}× per week`
                            : habit.frequency === "specific_days_weekly"
                            ? `${habit.specific_days ?? "custom"} weekly`
                            : habit.frequency === "specific_dates_monthly"
                            ? "Monthly"
                            : "Yearly"}
                          {habit.progress_metric ? ` · ${habit.progress_target} ${habit.progress_metric}` : ""}
                          {!habit.is_active && " · paused"}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingHabit(habit)}
                        className="text-xs flex-shrink-0"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={habit.is_active ? "outline" : "secondary"}
                        onClick={() => toggleHabitActive(habit)}
                        className="text-xs flex-shrink-0"
                      >
                        {habit.is_active ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <Separator />

        {/* ─── Notion Export ─── */}
        <section className="space-y-3">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Data & Export</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            All your habits, completions, events, and history live directly in your Notion workspace. You can view, filter, and export them at any time.
          </p>
          <div className="space-y-2">
            {notionHabitsUrl && (
              <a
                href={notionHabitsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-card text-[13px] hover:bg-muted transition-colors"
              >
                <span>📋</span>
                <span className="flex-1 font-medium">Open Habits in Notion</span>
                <span className="text-muted-foreground">↗</span>
              </a>
            )}
            {notionEventsUrl && (
              <a
                href={notionEventsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-card text-[13px] hover:bg-muted transition-colors"
              >
                <span>📅</span>
                <span className="flex-1 font-medium">Open Events in Notion</span>
                <span className="text-muted-foreground">↗</span>
              </a>
            )}
            {!notionHabitsUrl && !notionEventsUrl && (
              <p className="text-xs text-muted-foreground">
                Open <a href="https://notion.so" target="_blank" rel="noopener noreferrer" className="text-primary underline">notion.so</a> and find your Routine databases.
              </p>
            )}
          </div>
        </section>

        <div className="pt-4 border-t text-center text-[11px] text-muted-foreground tracking-[.08em]">
          Powered by Notion
        </div>

      </main>

      <AddItemSheet
        open={addHabitOpen}
        onOpenChange={(o) => {
          setAddHabitOpen(o);
          if (!o) handleHabitAdded();
        }}
        defaultTab="habit"
      />
      <EditHabitSheet
        habit={editingHabit}
        open={!!editingHabit}
        onOpenChange={(o) => { if (!o) setEditingHabit(null); }}
        onSaved={handleHabitUpdated}
      />
    </div>
  );
}
