"use client";

import { useState, useCallback, useEffect, useRef, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import HabitCard from "@/components/HabitCard";
import EventCard from "@/components/EventCard";
import AddItemSheet from "@/components/AddItemSheet";
import EditHabitSheet from "@/components/EditHabitSheet";
import EditEventSheet from "@/components/EditEventSheet";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { TodayEvent } from "@/app/actions/events";
import type { AppEvent } from "@/lib/notion/types";
import { format, addDays, subDays, parseISO, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  habits: ProcessedHabit[];
  events: TodayEvent[];
  today: string;
  weekEnd: string;
  weekStart: string;
  dayLabel: string;
  relativeLabel: string;
  dateStr: string;
}

export type OptimisticAction<T> = { action: "add" | "update" | "delete"; item: T };

type TimeKey = "morning" | "afternoon" | "evening" | "night";

const TIME_SECTIONS: { key: TimeKey; label: string; icon: string; range: string }[] = [
  { key: "morning",   label: "Morning",   icon: "🌅", range: "4 AM – 12 PM" },
  { key: "afternoon", label: "Afternoon", icon: "☀️",  range: "12 PM – 4 PM" },
  { key: "evening",   label: "Evening",   icon: "🌆", range: "4 PM – 8 PM"  },
  { key: "night",     label: "Night",     icon: "🌙", range: "8 PM – 4 AM"  },
];

const WEEK_SECTION_ORDER = ["morning", "afternoon", "evening", "night", "all_day"] as const;
type WeekSectionKey = (typeof WEEK_SECTION_ORDER)[number];
const WEEK_SECTION_LABELS: Record<WeekSectionKey, string> = {
  morning: "🌅 Morning", afternoon: "☀️ Afternoon", evening: "🌆 Evening", night: "🌙 Night", all_day: "🗓 All Day",
};

function hourToSection(h: number): TimeKey {
  if (h >= 4  && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 20) return "evening";
  return "night";
}

function habitSection(h: ProcessedHabit): TimeKey | null {
  if (h.time_of_day) return h.time_of_day as TimeKey;
  if (h.exact_time) return hourToSection(parseInt(h.exact_time));
  return null;
}

function parseHourFromTimeStr(timeStr: string): number {
  if (!timeStr) return -1;
  const d = new Date(timeStr);
  if (!isNaN(d.getTime())) return d.getHours();
  const timePart = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
  return parseInt(timePart.split(":")[0], 10);
}

function eventSection(e: TodayEvent): TimeKey | null {
  if (e.event_type === "timed" && e.start_time) {
    return hourToSection(parseHourFromTimeStr(e.start_time));
  }
  if (e.time_of_day) return e.time_of_day as TimeKey;
  if (e.due_time) return hourToSection(parseInt(e.due_time));
  return null;
}

function exactMinutes(h: ProcessedHabit): number {
  if (h.exact_time) {
    const [hr, m] = h.exact_time.split(":").map(Number);
    return hr * 60 + m;
  }
  return -1;
}

function eventMinutes(e: TodayEvent): number {
  if (e.event_type === "timed" && e.start_time) {
    const d = new Date(e.start_time);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
    const timePart = e.start_time.includes("T") ? e.start_time.split("T")[1] : e.start_time;
    const [h, m] = timePart.split(":").map(Number);
    return h * 60 + m;
  }
  if (e.due_time) {
    const [h, m] = e.due_time.split(":").map(Number);
    return h * 60 + m;
  }
  return -1;
}

type HabitWithDates = ProcessedHabit & { completions_by_date?: string[] };

const FAB_OPTIONS = [
  { tab: "habit"    as const, label: "Habit",    icon: "💪" },
  { tab: "timed"    as const, label: "Event",    icon: "📅" },
  { tab: "all_day"  as const, label: "Task",     icon: "📋" },
  { tab: "deadline" as const, label: "Deadline", icon: "⏰" },
];

export default function TodayClient({
  habits,
  events,
  today,
  weekEnd,
  weekStart,
  dayLabel,
  relativeLabel,
  dateStr,
}: Props) {
  const [optHabits, dispatchHabit] = useOptimistic(
    habits,
    (state: ProcessedHabit[], update: OptimisticAction<ProcessedHabit>) => {
      switch (update.action) {
        case "add": return [...state, update.item];
        case "update": return state.map(h => h.id === update.item.id ? update.item : h);
        case "delete": return state.filter(h => h.id !== update.item.id);
        default: return state;
      }
    }
  );

  const [optEvents, dispatchEvent] = useOptimistic(
    events,
    (state: TodayEvent[], update: OptimisticAction<TodayEvent>) => {
      switch (update.action) {
        case "add": return [...state, update.item];
        case "update": return state.map(e => e.id === update.item.id ? update.item : e);
        case "delete": return state.filter(e => e.id !== update.item.id);
        default: return state;
      }
    }
  );

  const router = useRouter();
  const [weekExpanded, setWeekExpanded] = useState(false);

  const [doneOverrides, setDoneOverrides] = useState<Map<string, boolean>>(new Map());
  function handleDoneChange(id: string, done: boolean) {
    setDoneOverrides((prev) => new Map(prev).set(id, done));
  }

  const [, startHabitTransition] = useTransition();

  function handleHabitToggle(id: string, done: boolean, serverFn: () => Promise<void>) {
    handleDoneChange(id, done);
    const h = optHabits.find(h => h.id === id) as HabitWithDates | undefined;
    if (!h) return;
    const byDate = h.completions_by_date ?? [];
    const newByDate: string[] = done
      ? [...byDate, dateStr]
      : byDate.filter((d: string) => d !== dateStr);
    const delta = done ? 1 : -1;
    startHabitTransition(async () => {
      dispatchHabit({
        action: "update",
        item: {
          ...h,
          completed_today: done ? 1 : 0,
          completions_this_week: Math.max(0, (h.completions_this_week ?? 0) + delta),
          completions_by_date: newByDate,
        },
      });
      // Await the actual Notion write: keeps this transition pending so
      // useOptimistic doesn't revert before Notion confirms the change.
      await serverFn();
    });
  }

  // — FAB dropdown —
  const [fabOpen, setFabOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<"habit" | "timed" | "all_day" | "deadline">("habit");
  const fabRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fabOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [fabOpen]);

  function openSheet(tab: "habit" | "timed" | "all_day" | "deadline") {
    setSheetTab(tab);
    setFabOpen(false);
    setSheetOpen(true);
  }

  // — Inline editing —
  const [editHabit, setEditHabit] = useState<ProcessedHabit | null>(null);
  const [editEvent, setEditEvent] = useState<TodayEvent | null>(null);

  const navigate = useCallback((direction: "prev" | "next") => {
    const base = parseISO(dateStr);
    const target = direction === "prev" ? subDays(base, 1) : addDays(base, 1);
    const newDate = format(target, "yyyy-MM-dd");
    if (newDate === format(new Date(), "yyyy-MM-dd")) {
      router.push("/today");
    } else {
      router.push(`/today?date=${newDate}`);
    }
  }, [dateStr, router]);

  const navigateToDate = useCallback((newDate: string) => {
    if (!newDate) return;
    if (newDate === format(new Date(), "yyyy-MM-dd")) {
      router.push("/today");
    } else {
      router.push(`/today?date=${newDate}`);
    }
  }, [router]);

  const visibleEvents = optEvents;
  const visibleHabits = optHabits.filter((h) => h.show && h.state !== "satisfied");
  const satisfiedHabits = optHabits.filter((h) => h.state === "satisfied");

  const doneCount =
    optHabits.filter((h) => doneOverrides.has(h.id) ? doneOverrides.get(h.id) : h.completed_today > 0).length +
    visibleEvents.filter((e) => doneOverrides.has(e.id) ? doneOverrides.get(e.id) : e.is_completed).length;
  const totalCount = optHabits.length + visibleEvents.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  // ── Bucket items into time sections ──────────────────────────────────────
  const habitsBySection = new Map<TimeKey, ProcessedHabit[]>();
  const allDayHabits: ProcessedHabit[] = [];
  for (const h of visibleHabits) {
    const sec = habitSection(h);
    if (sec) {
      if (!habitsBySection.has(sec)) habitsBySection.set(sec, []);
      habitsBySection.get(sec)!.push(h);
    } else {
      allDayHabits.push(h);
    }
  }
  for (const [, arr] of habitsBySection) {
    arr.sort((a, b) => exactMinutes(a) - exactMinutes(b));
  }

  const eventsBySection = new Map<TimeKey, TodayEvent[]>();
  const allDayEvents: TodayEvent[] = [];
  for (const e of visibleEvents) {
    const sec = eventSection(e);
    if (sec) {
      if (!eventsBySection.has(sec)) eventsBySection.set(sec, []);
      eventsBySection.get(sec)!.push(e);
    } else {
      allDayEvents.push(e);
    }
  }
  for (const [, arr] of eventsBySection) {
    arr.sort((a, b) => eventMinutes(a) - eventMinutes(b));
  }

  const weekDays = weekStart && weekEnd
    ? eachDayOfInterval({ start: parseISO(weekStart), end: parseISO(weekEnd) })
    : [];
  
  // The 'This Week' table only makes sense for habits tracked on a daily/weekly basis.
  // Exclude progress habits with monthly/yearly reset — their period spans beyond a week.
  const activeHabits = optHabits.filter((h) => {
    if (!h.is_active) return false;
    const freq = h.frequency;
    if (!(freq === "daily" || freq === "weekly" || freq === "specific_days_weekly")) return false;
    if (h.progress_metric && h.progress_period !== "daily") return false;
    return true;
  }) as HabitWithDates[];

  const habitsByWeekSection = new Map<WeekSectionKey, HabitWithDates[]>(
    WEEK_SECTION_ORDER.map((sec) => [sec, []])
  );
  for (const h of [...activeHabits].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))) {
    const sec = habitSection(h as ProcessedHabit) ?? "all_day";
    habitsByWeekSection.get(sec)!.push(h);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("prev")} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground" aria-label="Previous day">‹</button>
              {/* Clickable date label — opens native date picker */}
              <div className="relative">
                <button
                  onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                  className="text-center hover:bg-muted rounded-lg px-2 py-1 transition-colors"
                  aria-label="Pick a date"
                >
                  <h1 className={cn("text-sm font-semibold", relativeLabel === "Today" ? "text-primary" : "text-foreground")}>
                    {relativeLabel}
                  </h1>
                  {relativeLabel !== "Today" && relativeLabel !== dayLabel && (
                    <p className="text-xs text-muted-foreground">{dayLabel}</p>
                  )}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dateStr}
                  onChange={(e) => navigateToDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
              <button onClick={() => navigate("next")} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground" aria-label="Next day">›</button>
            </div>

            <div className="flex items-center gap-2">
              {!isToday && (
                <button onClick={() => router.push("/today")} className="text-xs text-primary font-medium">Go to today</button>
              )}
              <div className="flex items-center gap-1.5">
                <Progress value={progress} className="h-1.5 w-16" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{doneCount}/{totalCount}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-2xl mx-auto w-full space-y-6">

        {/* Time-of-day sections */}
        {TIME_SECTIONS.map(({ key, label, icon, range }) => {
          const sHabits = habitsBySection.get(key) ?? [];
          const sEvents = eventsBySection.get(key) ?? [];
          if (sHabits.length === 0 && sEvents.length === 0) return null;

          type Entry = {
            kind: "habit" | "event";
            item: ProcessedHabit | TodayEvent;
            sortKey: number;
            done: boolean;
            timed: boolean;
          };

          const entries: Entry[] = [
            ...sHabits.map((h) => ({
              kind: "habit" as const,
              item: h,
              sortKey: h.exact_time ? exactMinutes(h) : (h.sort_order ?? 9999),
              done: h.completed_today > 0,
              timed: !!h.exact_time,
            })),
            ...sEvents.map((e) => {
              const m = eventMinutes(e);
              return {
                kind: "event" as const,
                item: e,
                sortKey: m >= 0 ? m : 9999,
                done: e.is_completed,
                timed: m >= 0,
              };
            }),
          ];

          // Sort: untimed-notdone → timed-notdone → untimed-done → timed-done
          // Within each group: by sortKey (sort_order for untimed, time for timed)
          entries.sort((a, b) => {
            const groupA = (a.timed ? 1 : 0) + (a.done ? 2 : 0);
            const groupB = (b.timed ? 1 : 0) + (b.done ? 2 : 0);
            if (groupA !== groupB) return groupA - groupB;
            return a.sortKey - b.sortKey;
          });

          return (
            <section key={key}>
              <h2 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <span>{icon}</span>
                <span>{label}</span>
                <span className="font-normal opacity-60">· {range}</span>
              </h2>
              <div className="space-y-2">
                {entries.map((entry) =>
                  entry.kind === "habit" ? (
                    <HabitCard
                      key={entry.item.id}
                      habit={entry.item as ProcessedHabit}
                      today={today}
                      onDoneChange={handleDoneChange}
                      onToggle={handleHabitToggle}
                      onEdit={() => setEditHabit(entry.item as ProcessedHabit)}
                    />
                  ) : (
                    <EventCard
                      key={entry.item.id}
                      event={entry.item as TodayEvent}
                      onDoneChange={handleDoneChange}
                      onEdit={() => setEditEvent(entry.item as TodayEvent)}
                    />
                  )
                )}
              </div>
            </section>
          );
        })}

        {/* All Day — untimed items */}
        {(allDayHabits.length > 0 || allDayEvents.length > 0) && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2">🗓 All Day</h2>
            <div className="space-y-2">
              {[
                ...allDayHabits.map(h => ({ kind: "habit" as const, item: h, sortKey: h.sort_order ?? 9999, done: h.completed_today > 0 })),
                ...allDayEvents.map(e => ({ kind: "event" as const, item: e, sortKey: 9999, done: e.is_completed })),
              ]
                .sort((a, b) => {
                  if (a.done !== b.done) return a.done ? 1 : -1;
                  return a.sortKey - b.sortKey;
                })
                .map(entry =>
                  entry.kind === "habit" ? (
                    <HabitCard
                      key={entry.item.id}
                      habit={entry.item}
                      today={today}
                      onDoneChange={handleDoneChange}
                      onToggle={handleHabitToggle}
                      onEdit={() => setEditHabit(entry.item)}
                    />
                  ) : (
                    <EventCard
                      key={entry.item.id}
                      event={entry.item}
                      onDoneChange={handleDoneChange}
                      onEdit={() => setEditEvent(entry.item)}
                    />
                  )
                )
              }
            </div>
          </section>
        )}

        {/* Weekly goals met */}
        {satisfiedHabits.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2">Weekly goals met ✓</h2>
            <div className="space-y-2">
              {satisfiedHabits.map((h) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  today={today}
                  onDoneChange={handleDoneChange}
                  onToggle={handleHabitToggle}
                  onEdit={() => setEditHabit(h)}
                />
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

        {/* This Week — collapsible habit grid */}
        {activeHabits.length > 0 && weekDays.length === 7 && (
          <section className="border rounded-2xl bg-card card-elevated overflow-hidden">
            <button
              onClick={() => setWeekExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-semibold text-muted-foreground">This Week</span>
              <span className="text-xs text-muted-foreground">{weekExpanded ? "▲" : "▼"}</span>
            </button>

            {weekExpanded && (
              <div className="px-4 pb-4 space-y-3 overflow-x-auto">
                {/* Day header */}
                <div className="grid gap-1 items-center min-w-[420px]" style={{ gridTemplateColumns: "minmax(100px,1fr) repeat(7, 1.75rem)" }}>
                  <div />
                  {weekDays.map((d) => (
                    <div key={d.toISOString()} className="text-center text-xs text-muted-foreground font-medium">
                      {format(d, "EEE")[0]}
                    </div>
                  ))}
                </div>

                {/* Habits grouped by section */}
                {WEEK_SECTION_ORDER.map((sec) => {
                  const secHabits = habitsByWeekSection.get(sec) ?? [];
                  if (secHabits.length === 0) return null;
                  return (
                    <div key={sec} className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[420px]">
                        {WEEK_SECTION_LABELS[sec]}
                      </p>
                      {secHabits.map((habit) => {
                        const target = habit.frequency === "daily" ? 7 : (habit.weekly_target ?? 1);
                        const done = Number(habit.completions_this_week);
                        const pct = Math.min(100, Math.round((done / target) * 100));
                        const completedSet = new Set(habit.completions_by_date ?? []);
                        return (
                          <div key={habit.id} className="space-y-1 min-w-[420px]">
                            <div className="grid gap-1 items-center" style={{ gridTemplateColumns: "minmax(100px,1fr) repeat(7, 1.75rem)" }}>
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span className="text-xs font-medium">{habit.name}</span>
                              </div>
                              {weekDays.map((d) => {
                                const dayStr = format(d, "yyyy-MM-dd");
                                const completed = completedSet.has(dayStr);
                                return (
                                  <div
                                    key={dayStr}
                                    className={cn("w-7 h-7 rounded-full flex items-center justify-center mx-auto", completed ? "bg-primary text-primary-foreground" : "bg-muted")}
                                  >
                                    {completed && (
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 min-w-[420px]">
                              <Progress value={pct} className="flex-1 h-1" />
                              <span className="text-xs text-muted-foreground flex-shrink-0 w-10 text-right">{done}/{target}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* FAB with dropdown */}
      <div ref={fabRef} className="fixed bottom-20 right-4 lg:bottom-6 z-40 flex flex-col items-end gap-2">
        {/* Dropdown menu */}
        {fabOpen && (
          <div className="bg-card border rounded-2xl shadow-lg overflow-hidden mb-1 min-w-[140px]">
            {FAB_OPTIONS.map(({ tab, label, icon }) => (
              <button
                key={tab}
                onClick={() => openSheet(tab)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors text-left"
              >
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        {/* FAB button */}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className={cn(
            "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:bg-primary/90 active:scale-95 transition-all",
            fabOpen && "rotate-45"
          )}
          aria-label="Add item"
        >
          +
        </button>
      </div>

      {/* Sheets */}
      <AddItemSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
        defaultTab={sheetTab} 
        dispatchHabit={dispatchHabit}
        dispatchEvent={dispatchEvent}
      />
      <EditHabitSheet
        habit={editHabit}
        open={!!editHabit}
        onOpenChange={(o) => { if (!o) setEditHabit(null); }}
        dispatchHabit={dispatchHabit}
      />
      <EditEventSheet
        event={editEvent as AppEvent | null}
        open={!!editEvent}
        onOpenChange={(o) => { if (!o) setEditEvent(null); }}
        dispatchEvent={dispatchEvent}
      />
    </div>
  );
}
