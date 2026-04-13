"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO, isToday,
} from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AddItemSheet from "@/components/AddItemSheet";
import type { AppEvent } from "@/lib/notion/types";
import { cn } from "@/lib/utils";

interface Props {
  events: AppEvent[];
  weekStartDay: number;
}

const EVENT_TYPE_DOT: Record<string, string> = {
  timed: "bg-primary",
  all_day: "bg-emerald-500",
  deadline: "bg-orange-500",
};

function getEventDate(event: AppEvent): string | null {
  if (event.event_type === "timed" && event.start_time) {
    return event.start_time.split("T")[0];
  }
  return event.due_date;
}

function formatEventTime(event: AppEvent): string {
  if (event.event_type === "timed" && event.start_time) {
    const d = new Date(event.start_time);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
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
  if (event.event_type === "deadline") {
    return "Deadline";
  }
  return "All day";
}

export default function CalendarClient({ events, weekStartDay }: Props) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const weekStartsOn = (weekStartDay === 0 ? 0 : 1) as 0 | 1;

  // Day-of-week headers
  const dayHeaders = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return format(d, "EEE");
    });
  }, [weekStartsOn]);

  // All days in the visible grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth, weekStartsOn]);

  // Index events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AppEvent[]>();
    for (const event of events) {
      const dateStr = getEventDate(event);
      if (!dateStr) continue;
      const list = map.get(dateStr) ?? [];
      list.push(event);
      map.set(dateStr, list);
    }
    return map;
  }, [events]);

  const selectedDayStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedEvents = selectedDayStr ? (eventsByDate.get(selectedDayStr) ?? []) : [];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto lg:max-w-none flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground text-lg"
            >
              ‹
            </button>
            <h1 className="text-base font-bold w-36 text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h1>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground text-lg"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs text-primary font-medium px-2 py-1 rounded-lg hover:bg-accent transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium hover:bg-primary/90 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-32 max-w-2xl mx-auto w-full lg:max-w-none">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-2xl overflow-hidden">
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const todayFlag = isToday(day);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "bg-card flex flex-col items-center py-2 px-1 min-h-[3.5rem] transition-colors hover:bg-accent/50",
                  !inMonth && "opacity-30",
                  isSelected && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    todayFlag && "bg-primary text-primary-foreground",
                    !todayFlag && isSelected && "text-accent-foreground font-bold",
                    !todayFlag && !isSelected && "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-full">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span
                        key={i}
                        className={cn("w-1.5 h-1.5 rounded-full", EVENT_TYPE_DOT[e.event_type] ?? "bg-muted-foreground")}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-muted-foreground leading-none">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Event
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Task
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Deadline
          </span>
        </div>
      </main>

      {/* Day detail sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
        <SheetContent side="bottom" className="h-[60vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {selectedDay ? format(selectedDay, "EEEE, MMMM d") : ""}
            </SheetTitle>
          </SheetHeader>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No events on this day.</p>
              <button
                onClick={() => {
                  setSelectedDay(null);
                  router.push(`/today?date=${selectedDayStr}`);
                }}
                className="mt-2 text-primary text-sm font-medium"
              >
                View day →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                  <span className="text-base">
                    {event.event_type === "deadline"
                      ? "⏰"
                      : event.event_type === "timed"
                      ? "📅"
                      : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm", event.is_completed && "line-through text-muted-foreground")}>
                      {event.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatEventTime(event)}</p>
                  </div>
                  {event.is_completed && (
                    <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Done</span>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  setSelectedDay(null);
                  router.push(`/today?date=${selectedDayStr}`);
                }}
                className="w-full text-sm text-primary font-medium py-2 rounded-xl hover:bg-accent transition-colors"
              >
                Open in Today view →
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} defaultTab="timed" />
    </div>
  );
}
