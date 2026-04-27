"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isSameWeek, isSameYear,
  addMonths, addWeeks, addDays,
  addYears, isToday,
  getYear, parseISO,
} from "date-fns";
// removed toZonedTime import
import { parseZonedOrLocal } from "@/lib/habit-logic";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AddItemSheet from "@/components/AddItemSheet";
import EditEventSheet from "@/components/EditEventSheet";
import type { AppEvent, Group } from "@/lib/notion/types";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/SettingsProvider";
import GroupFilterBar from "@/components/GroupFilterBar";

type CalendarView = "day" | "week" | "month" | "year" | "schedule";

interface Props {
  events: AppEvent[];
  groups: Group[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEventDate(event: AppEvent, timezone: string): string | null {
  if (event.event_type === "timed" && event.start_time) {
    // Convert UTC timestamp to user's timezone before extracting the date
    const localDate = parseZonedOrLocal(event.start_time, timezone);
    return format(localDate, "yyyy-MM-dd");
  }
  return event.due_date;
}

function parseHourMin(timeStr: string | null | undefined, timezone?: string): { h: number; m: number } | null {
  if (!timeStr) return null;
  if (timeStr.includes("T") || timeStr.endsWith("Z")) {
    // Full ISO datetime — convert to local timezone first
    const localDate = parseZonedOrLocal(timeStr, timezone ?? "UTC");
    return { h: localDate.getHours(), m: localDate.getMinutes() };
  }
  const [h, m] = timeStr.split(":").map(Number);
  return { h, m };
}

function formatEventTime(event: AppEvent, timezone: string): string {
  if (event.event_type === "timed" && event.start_time) {
    const hm = parseHourMin(event.start_time, timezone);
    if (!hm) return "";
    const ampm = hm.h >= 12 ? "PM" : "AM";
    const hour = hm.h % 12 || 12;
    return `${hour}:${String(hm.m).padStart(2, "0")} ${ampm}`;
  }
  if (event.due_time) {
    const [h, m] = event.due_time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  if (event.time_of_day) {
    const map: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
    return map[event.time_of_day] ?? "";
  }
  if (event.event_type === "deadline") return "Deadline";
  return "All day";
}

function eventTypeColor(type: AppEvent["event_type"]): string {
  if (type === "timed") return "bg-blue-500";
  if (type === "all_day") return "bg-emerald-500";
  return "bg-orange-500";
}

function eventTypeColorHex(type: AppEvent["event_type"]): string {
  if (type === "timed") return "#3b82f6";
  if (type === "all_day") return "#10b981";
  return "#f97316";
}

function eventIcon(event: AppEvent): string {
  if (event.event_type === "deadline") return "⏰";
  if (event.event_type === "all_day") return "📋";
  return "📅";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CalendarClient({ events, groups }: Props) {
  const { timezone, week_start_day: weekStartDay } = useSettings();
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"habit" | "timed" | "all_day" | "deadline">("timed");
  const [addDefaultDate, setAddDefaultDate] = useState<string | undefined>();
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [addDropdownOpen]);

  const weekStartsOn = (weekStartDay === 0 ? 0 : 1) as 0 | 1;

  // Current time for day/week indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Navigation
  function navigate(dir: "prev" | "next") {
    const d = dir === "prev" ? -1 : 1;
    if (view === "day") setCurrentDate((c) => addDays(c, d));
    else if (view === "week") setCurrentDate((c) => addWeeks(c, d));
    else if (view === "month") setCurrentDate((c) => addMonths(c, d));
    else if (view === "year") setCurrentDate((c) => addYears(c, d));
  }

  // Index events by date (respects group filter)
  const eventsByDate = useMemo(() => {
    const filtered = (() => {
      if (groupFilters.length === 0) return events;
      return events.filter((e) =>
        e.group_id ? groupFilters.includes(e.group_id) : groupFilters.includes("unassigned")
      );
    })();
    const map = new Map<string, AppEvent[]>();
    for (const event of filtered) {
      const dateStr = getEventDate(event, timezone);
      if (!dateStr) continue;
      const list = map.get(dateStr) ?? [];
      list.push(event);
      map.set(dateStr, list);
    }
    return map;
  }, [events, timezone, groupFilters]);

  function openAdd(tab: "habit" | "timed" | "all_day" | "deadline", dateStr?: string) {
    setAddTab(tab);
    setAddDefaultDate(dateStr);
    setAddDropdownOpen(false);
    setAddOpen(true);
  }

  // ── Day view ──────────────────────────────────────────────────────────────
  const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
  const PX_PER_HOUR = 56;

  function timeToTopPx(h: number, m: number): number {
    return (h * 60 + m) * (PX_PER_HOUR / 60);
  }

  function timedEventsForDate(dateStr: string): AppEvent[] {
    return (eventsByDate.get(dateStr) ?? []).filter((e) => e.event_type === "timed" && e.start_time);
  }

  function allDayEventsForDate(dateStr: string): AppEvent[] {
    return (eventsByDate.get(dateStr) ?? []).filter((e) => e.event_type !== "timed");
  }

  function renderTimedEventBlock(event: AppEvent, colWidth: string = "calc(100% - 4px)") {
    const hm = parseHourMin(event.start_time, timezone);
    if (!hm) return null;
    const endHm = parseHourMin(event.end_time, timezone);
    const durationMin = endHm ? (endHm.h * 60 + endHm.m) - (hm.h * 60 + hm.m) : 60;
    const clampedDuration = Math.max(30, durationMin);
    const top = timeToTopPx(hm.h, hm.m);
    const height = clampedDuration * (PX_PER_HOUR / 60);
    return (
      <button
        key={event.id}
        onClick={() => setEditingEvent(event)}
        className="absolute left-1 rounded-lg px-2 py-1 text-left text-white overflow-hidden hover:opacity-90 transition-opacity"
        style={{
          top: `${top}px`,
          height: `${height}px`,
          width: colWidth,
          backgroundColor: groups.find((g) => g.id === event.group_id)?.color ?? eventTypeColorHex(event.event_type),
          minHeight: "24px",
        }}
      >
        <p className="text-xs font-semibold leading-tight truncate">{event.title}</p>
        <p className="text-[10px] opacity-80">{formatEventTime(event, timezone)}</p>
      </button>
    );
  }

  function DayView() {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const timedEvents = timedEventsForDate(dateStr);
    const allDayEvs = allDayEventsForDate(dateStr);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const showNowLine = format(now, "yyyy-MM-dd") === dateStr;

    return (
      <div className="flex flex-col h-full">
        {/* All-day strip */}
        {allDayEvs.length > 0 && (
          <div className="border-b px-4 py-2 space-y-1">
            <p className="text-xs text-muted-foreground mb-1">All day</p>
            {allDayEvs.map((e) => (
              <button
                key={e.id}
                onClick={() => setEditingEvent(e)}
                className={cn("w-full text-left text-xs px-2 py-1 rounded-md text-white font-medium", eventTypeColor(e.event_type))}
              >
                {e.title}
              </button>
            ))}
          </div>
        )}
        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative flex" style={{ height: `${PX_PER_HOUR * 24}px` }}>
            {/* Hour labels */}
            <div className="flex-shrink-0 w-14 relative">
              {HOURS.map((h) => (
                <div key={h} className="absolute right-2 text-xs text-muted-foreground" style={{ top: `${timeToTopPx(h, 0) - 8}px` }}>
                  {h === 0 ? "" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </div>
              ))}
            </div>
            {/* Grid lines + events */}
            <div className="flex-1 relative border-l">
              {HOURS.map((h) => (
                <div key={h} className="absolute w-full border-t border-border/50" style={{ top: `${timeToTopPx(h, 0)}px` }} />
              ))}
              {/* Current time line */}
              {showNowLine && (
                <div className="absolute w-full flex items-center z-10" style={{ top: `${nowMinutes * (PX_PER_HOUR / 60)}px` }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 h-px bg-red-500" />
                </div>
              )}
              {/* Events */}
              {timedEvents.map((e) => renderTimedEventBlock(e))}
              {/* Click to add */}
              <div
                className="absolute inset-0 cursor-pointer"
                style={{ zIndex: -1 }}
                onClick={() => {
                  openAdd("timed", dateStr);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Week view ─────────────────────────────────────────────────────────────
  function WeekView() {
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b flex-shrink-0">
          <div className="w-14 flex-shrink-0" />
          {weekDays.map((day) => {
            const todayFlag = isToday(day);
            return (
              <div key={day.toISOString()} className="flex-1 text-center py-2 border-l">
                <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                <p className={cn(
                  "text-sm font-semibold w-7 h-7 rounded-full flex items-center justify-center mx-auto",
                  todayFlag && "bg-primary text-primary-foreground"
                )}>
                  {format(day, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* All-day strip */}
        {weekDays.some((d) => allDayEventsForDate(format(d, "yyyy-MM-dd")).length > 0) && (
          <div className="flex border-b flex-shrink-0">
            <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2">
              <span className="text-[10px] text-muted-foreground">All day</span>
            </div>
            {weekDays.map((day) => {
              const ds = format(day, "yyyy-MM-dd");
              const evs = allDayEventsForDate(ds);
              return (
                <div key={day.toISOString()} className="flex-1 border-l px-0.5 py-0.5 min-h-[28px]">
                  {evs.slice(0, 2).map((e) => (
                    <button key={e.id} onClick={() => setEditingEvent(e)}
                      className={cn("w-full text-[10px] px-1 py-0.5 rounded text-white truncate block mb-0.5", eventTypeColor(e.event_type))}>
                      {e.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative flex" style={{ height: `${PX_PER_HOUR * 24}px` }}>
            {/* Hour labels */}
            <div className="w-14 flex-shrink-0 relative">
              {HOURS.map((h) => (
                <div key={h} className="absolute right-2 text-xs text-muted-foreground" style={{ top: `${timeToTopPx(h, 0) - 8}px` }}>
                  {h === 0 ? "" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </div>
              ))}
            </div>
            {/* Columns */}
            <div className="flex-1 flex">
              {weekDays.map((day) => {
                const ds = format(day, "yyyy-MM-dd");
                const timedEvs = timedEventsForDate(ds);
                const showNow = format(now, "yyyy-MM-dd") === ds;

                return (
                  <div key={day.toISOString()} className="flex-1 relative border-l">
                    {HOURS.map((h) => (
                      <div key={h} className="absolute w-full border-t border-border/40" style={{ top: `${timeToTopPx(h, 0)}px` }} />
                    ))}
                    {showNow && (
                      <div className="absolute w-full flex items-center z-10" style={{ top: `${nowMinutes * (PX_PER_HOUR / 60)}px` }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                        <div className="flex-1 h-px bg-red-500" />
                      </div>
                    )}
                    {timedEvs.map((e) => renderTimedEventBlock(e, "calc(100% - 4px)"))}
                    {/* Click to add */}
                    <div
                      className="absolute inset-0 cursor-pointer"
                      style={{ zIndex: -1 }}
                      onClick={() => openAdd("timed", ds)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Month view ────────────────────────────────────────────────────────────
  function MonthView() {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
    const calDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const dayHeaders = useMemo(() => {
      const base = startOfWeek(new Date(), { weekStartsOn });
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        return format(d, "EEE");
      });
    }, []);

    return (
      <div className="px-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7">
          {calDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const inMonth = isSameMonth(day, currentDate);
            const todayFlag = isToday(day);

            return (
              <div
                key={dateStr}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                className={cn(
                  "border-b border-r min-h-[80px] p-1 flex flex-col text-left transition-colors hover:bg-accent/30 cursor-pointer",
                  !inMonth && "opacity-30",
                  isSameDay(day, selectedDay ?? new Date(0)) && "bg-accent/40"
                )}
              >
                <span className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 self-start",
                  todayFlag && "bg-primary text-primary-foreground",
                )}>
                  {format(day, "d")}
                </span>
                {/* Event chips */}
                <div className="flex flex-col gap-0.5 w-full">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); setEditingEvent(e); }}
                      onKeyDown={(ev) => ev.key === "Enter" && (ev.stopPropagation(), setEditingEvent(e))}
                      className={cn("text-[10px] px-1 py-0.5 rounded text-white text-left truncate w-full cursor-pointer flex items-center gap-1", eventTypeColor(e.event_type))}
                    >
                      {groups.find((g) => g.id === e.group_id) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
                      )}
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Year view ─────────────────────────────────────────────────────────────
  function YearView() {
    const year = getYear(currentDate);
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    return (
      <div className="grid grid-cols-3 gap-4 p-4 md:grid-cols-4">
        {months.map((monthDate) => {
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const gridStart = startOfWeek(monthStart, { weekStartsOn });
          const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
          const miniDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

          return (
            <button
              key={monthDate.toISOString()}
              onClick={() => { setCurrentDate(monthDate); setView("month"); }}
              className="text-left rounded-xl border bg-card hover:bg-accent/30 transition-colors p-3"
            >
              <p className="text-xs font-semibold mb-2">{format(monthDate, "MMMM")}</p>
              <div className="grid grid-cols-7 gap-px">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-[9px] text-muted-foreground text-center font-medium">{d}</div>
                ))}
                {miniDays.map((day) => {
                  const ds = format(day, "yyyy-MM-dd");
                  const hasEvents = (eventsByDate.get(ds) ?? []).length > 0;
                  const todayFlag = isToday(day);
                  const inMonth = isSameMonth(day, monthDate);
                  const evType = eventsByDate.get(ds)?.[0]?.event_type;
                  return (
                    <div
                      key={ds}
                      className={cn(
                        "w-4 h-4 flex items-center justify-center text-[9px] rounded-full mx-auto",
                        !inMonth && "opacity-20",
                        todayFlag && "bg-primary text-primary-foreground font-bold",
                        hasEvents && !todayFlag && "font-semibold"
                      )}
                    >
                      {hasEvents && !todayFlag && inMonth ? (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: eventTypeColorHex(evType ?? "timed") }} />
                      ) : (
                        <span>{inMonth ? format(day, "d") : ""}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Schedule view ─────────────────────────────────────────────────────────
  function ScheduleView() {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const endStr = `${getYear(new Date())}-06-30`;

    // Collect all event dates in range, sorted
    const dateSet = new Set<string>();
    for (const event of events) {
      const ds = getEventDate(event, timezone);
      if (ds && ds >= todayStr && ds <= endStr) dateSet.add(ds);
    }
    const sortedDates = Array.from(dateSet).sort();

    if (sortedDates.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No upcoming events through June 30.
        </div>
      );
    }

    return (
      <div className="divide-y">
        {sortedDates.map((ds) => {
          const dayEvents = (eventsByDate.get(ds) ?? []).filter(
            (e) => getEventDate(e, timezone) === ds
          );
          return (
            <div key={ds} className="px-4 py-3">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-fraunces font-normal text-[18px]">{format(parseISO(ds), "EEEE")}</span>
                <span className="text-[11px] text-muted-foreground tracking-[.1em] uppercase">{format(parseISO(ds), "MMMM d")}</span>
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEditingEvent(e)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border bg-card text-left hover:bg-accent/40 transition-colors"
                  >
                    <span className="text-base flex-shrink-0">{eventIcon(e)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", e.is_completed && "line-through text-muted-foreground")}>
                        {e.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatEventTime(e, timezone)}</p>
                    </div>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: groups.find((g) => g.id === e.group_id)?.color ?? eventTypeColorHex(e.event_type) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const VIEW_LABELS: Record<CalendarView, string> = {
    day: "Day", week: "Week", month: "Month", year: "Year", schedule: "Schedule",
  };

  const showNav = view !== "schedule";

  const _today = new Date();
  const isOnToday =
    view === "month"    ? isSameMonth(currentDate, _today) :
    view === "week"     ? isSameWeek(currentDate, _today, { weekStartsOn: weekStartDay as 0 | 1 }) :
    view === "year"     ? isSameYear(currentDate, _today) :
    view === "day"      ? isToday(currentDate) :
    true;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Left: nav + title */}
          <div className="flex items-center gap-1 min-w-0">
            {showNav && (
              <button
                onClick={() => navigate("prev")}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Previous"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div className="px-1">
              <div className="font-fraunces font-normal text-[22px] tracking-tight leading-tight">
                {view === "month" || view === "week" ? format(currentDate, "MMMM") : view === "year" ? format(currentDate, "yyyy") : "Schedule"}
              </div>
              {(view === "month" || view === "week") && (
                isOnToday
                  ? <div className="text-[11px] text-muted-foreground tracking-[.12em] uppercase">{format(currentDate, "yyyy")}</div>
                  : <button onClick={() => setCurrentDate(new Date())} className="text-[11px] text-primary font-medium tracking-[.04em] hover:underline">Today</button>
              )}
              {view === "year" && !isOnToday && (
                <button onClick={() => setCurrentDate(new Date())} className="text-[11px] text-primary font-medium tracking-[.04em] hover:underline">Today</button>
              )}
            </div>
            {showNav && (
              <button
                onClick={() => navigate("next")}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Next"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>

          {/* Right: view selector + add */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View segmented control */}
            <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
              {(["month", "week", "year", "schedule"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-[10px] text-[11px] font-medium transition-all",
                    view === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
            {/* Add dropdown */}
            <div ref={addDropdownRef} className="relative">
              <button
                onClick={() => setAddDropdownOpen((v) => !v)}
                className={cn(
                  "w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium hover:bg-primary/90 transition-all",
                  addDropdownOpen && "rotate-45"
                )}
                aria-label="Add item"
              >
                +
              </button>
              {addDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 bg-card border rounded-2xl shadow-lg overflow-hidden z-50 min-w-[150px]">
                  {([
                    { tab: "habit"    as const, label: "Habit",    icon: "💪" },
                    { tab: "timed"    as const, label: "Event",    icon: "📅" },
                    { tab: "all_day"  as const, label: "Task",     icon: "📋" },
                    { tab: "deadline" as const, label: "Deadline", icon: "⏰" },
                  ]).map(({ tab, label, icon }) => (
                    <button
                      key={tab}
                      onClick={() => openAdd(tab)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-accent transition-colors text-left"
                    >
                      <span className="text-base">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {groups.length > 0 && (
        <div className="px-4 py-2 border-b max-w-4xl mx-auto w-full">
          <GroupFilterBar groups={groups} activeFilters={groupFilters} onFilterChange={setGroupFilters} />
        </div>
      )}

      {/* View content */}
      <main className={cn(
        "flex-1 max-w-4xl mx-auto w-full",
        view === "day" || view === "week" ? "overflow-hidden flex flex-col" : "overflow-y-auto pb-24"
      )}>
        {view === "month"    && <MonthView />}
        {view === "year"     && <YearView />}
        {view === "schedule" && <ScheduleView />}
        {view === "day"      && <DayView />}
        {view === "week"     && <WeekView />}
      </main>

      {/* Day detail sheet (month view click) */}
      <Sheet open={!!selectedDay && view === "month"} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto rounded-t-3xl px-5 md:px-8 pb-10">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <SheetHeader className="mb-6 pt-2">
            <SheetTitle className="font-fraunces font-normal text-[22px] tracking-tight">
              {selectedDay ? format(selectedDay, "EEEE, MMMM d") : ""}
            </SheetTitle>
          </SheetHeader>

          {/* Add buttons for this day */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {([
              { tab: "timed"    as const, label: "Event",    icon: "📅" },
              { tab: "all_day"  as const, label: "Task",     icon: "📋" },
              { tab: "deadline" as const, label: "Deadline", icon: "⏰" },
            ]).map(({ tab, label, icon }) => (
              <button
                key={tab}
                onClick={() => {
                  openAdd(tab, selectedDay ? format(selectedDay, "yyyy-MM-dd") : undefined);
                  setSelectedDay(null);
                }}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border bg-card hover:bg-accent transition-colors"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium text-foreground">+ {label}</span>
              </button>
            ))}
          </div>

          {/* Day's events */}
          {selectedDay && (eventsByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Events</p>
              {(selectedDay ? eventsByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? [] : []).map((event) => (
                <button
                  key={event.id}
                  onClick={() => { setEditingEvent(event); setSelectedDay(null); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border bg-card text-left hover:bg-accent/40 transition-colors"
                >
                  <span className="text-xl flex-shrink-0">{eventIcon(event)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm", event.is_completed && "line-through text-muted-foreground")}>
                      {event.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatEventTime(event, timezone)}</p>
                  </div>
                  <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", eventTypeColor(event.event_type))} />
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <EditEventSheet
        event={editingEvent}
        open={!!editingEvent}
        onOpenChange={(o) => { if (!o) setEditingEvent(null); }}
        groups={groups}
      />
      <AddItemSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultTab={addTab}
        defaultDate={addDefaultDate}
        groups={groups}
      />
    </div>
  );
}
