"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/SettingsProvider";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { TodayEvent } from "@/app/actions/events";

const PX_PER_MIN = 1; // 60px/hr → 1px/min

interface Props {
  habits: ProcessedHabit[];
  events: TodayEvent[];
  dateStr: string;
  doneOverrides: Map<string, boolean>;
  onViewHabit?: (h: ProcessedHabit) => void;
  onViewEvent?: (e: TodayEvent) => void;
}

function parseMinutesFromISO(isoStr: string): number {
  const d = new Date(isoStr);
  if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  const t = isoStr.includes("T") ? isoStr.split("T")[1] : isoStr;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseMinutesFromHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

type ScheduledItem =
  | { kind: "habit"; item: ProcessedHabit; startMin: number; durMin: number }
  | { kind: "event"; item: TodayEvent; startMin: number; durMin: number };

export default function TimetableView({ habits, events, dateStr, doneOverrides, onViewHabit, onViewEvent }: Props) {
  const settings = useSettings();
  const dayStart = settings.day_start_hour ?? 0;
  const totalMinutes = (24 - dayStart) * 60;
  const totalHeight = totalMinutes * PX_PER_MIN;

  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // Scroll now-line into view on mount
  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const scheduled: ScheduledItem[] = [];
  const unscheduled: Array<{ kind: "habit"; item: ProcessedHabit } | { kind: "event"; item: TodayEvent }> = [];

  for (const h of habits) {
    if (h.exact_time) {
      const startMin = parseMinutesFromHHMM(h.exact_time);
      const durMin = h.duration_minutes ?? 30;
      scheduled.push({ kind: "habit", item: h, startMin, durMin });
    } else {
      unscheduled.push({ kind: "habit", item: h });
    }
  }

  for (const e of events) {
    if (e.event_type === "timed" && e.start_time) {
      const startMin = parseMinutesFromISO(e.start_time);
      let durMin = e.duration_minutes ?? 30;
      if (e.start_time && e.end_time) {
        const diff = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
        if (diff > 0) durMin = Math.round(diff);
      }
      scheduled.push({ kind: "event", item: e, startMin, durMin });
    } else {
      unscheduled.push({ kind: "event", item: e });
    }
  }

  function isDone(si: ScheduledItem | typeof unscheduled[number]): boolean {
    const id = si.item.id;
    if (doneOverrides.has(id)) return doneOverrides.get(id)!;
    if (si.kind === "habit") return (si.item as ProcessedHabit).completed_today > 0;
    return (si.item as TodayEvent).is_completed;
  }

  function itemTop(startMin: number) {
    return Math.max(0, (startMin - dayStart * 60)) * PX_PER_MIN;
  }

  function itemColor(si: ScheduledItem) {
    if (si.kind === "habit") return "bg-indigo-100 border-indigo-400 dark:bg-indigo-900/40 dark:border-indigo-500 text-indigo-900 dark:text-indigo-100";
    const e = si.item as TodayEvent;
    if (e.event_type === "timed") return "bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:border-blue-500 text-blue-900 dark:text-blue-100";
    return "bg-orange-100 border-orange-400 dark:bg-orange-900/40 dark:border-orange-500 text-orange-900 dark:text-orange-100";
  }

  const hours = Array.from({ length: 24 - dayStart + 1 }, (_, i) => dayStart + i);

  return (
    <div className="flex flex-col gap-0">
      {/* Scrollable timeline */}
      <div className="overflow-y-auto max-h-[65vh] relative">
        <div className="flex" style={{ height: totalHeight + 32 }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative select-none">
            {hours.map(h => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted-foreground -translate-y-1/2 pr-1"
                style={{ top: (h - dayStart) * 60 * PX_PER_MIN }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Timeline body */}
          <div className="flex-1 relative border-l" style={{ minHeight: totalHeight }}>
            {/* Hour grid lines */}
            {hours.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: (h - dayStart) * 60 * PX_PER_MIN }}
              />
            ))}

            {/* Now line */}
            {nowMinutes !== null && nowMinutes >= dayStart * 60 && (
              <div
                ref={nowLineRef}
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: (nowMinutes - dayStart * 60) * PX_PER_MIN }}
              >
                <div className="relative flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 h-px bg-red-500" />
                </div>
              </div>
            )}

            {/* Scheduled items */}
            {scheduled.map((si, idx) => {
              const top = itemTop(si.startMin);
              const height = Math.max(20, si.durMin * PX_PER_MIN);
              const done = isDone(si);
              const label = si.kind === "habit" ? (si.item as ProcessedHabit).name : (si.item as TodayEvent).title;
              const durLabel = si.durMin >= 60
                ? `${Math.floor(si.durMin / 60)}h${si.durMin % 60 ? ` ${si.durMin % 60}m` : ""}`
                : `${si.durMin}m`;
              return (
                <div
                  key={`${si.kind}-${si.item.id}-${idx}`}
                  className={cn(
                    "absolute left-1 right-1 rounded-lg border px-2 py-1 cursor-pointer overflow-hidden transition-opacity",
                    itemColor(si),
                    done && "opacity-40"
                  )}
                  style={{ top, height }}
                  onClick={() => {
                    if (si.kind === "habit") onViewHabit?.(si.item as ProcessedHabit);
                    else onViewEvent?.(si.item as TodayEvent);
                  }}
                >
                  <p className="text-[11px] font-semibold leading-tight truncate">{label}</p>
                  {height >= 32 && (
                    <p className="text-[10px] opacity-70">{durLabel}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled items */}
      {unscheduled.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground px-1">Unscheduled</p>
          <div className="space-y-1">
            {unscheduled.map((si, idx) => {
              const done = isDone(si);
              const label = si.kind === "habit" ? (si.item as ProcessedHabit).name : (si.item as TodayEvent).title;
              const durMin = si.kind === "habit"
                ? (si.item as ProcessedHabit).duration_minutes
                : (si.item as TodayEvent).duration_minutes;
              return (
                <div
                  key={`${si.kind}-${si.item.id}-${idx}`}
                  onClick={() => {
                    if (si.kind === "habit") onViewHabit?.(si.item as ProcessedHabit);
                    else onViewEvent?.(si.item as TodayEvent);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-card cursor-pointer hover:bg-muted/50 transition-colors",
                    done && "opacity-50"
                  )}
                >
                  <span className="text-sm">{si.kind === "habit" ? "💪" : "📋"}</span>
                  <span className={cn("flex-1 text-sm font-medium", done && "line-through text-muted-foreground")}>
                    {label}
                  </span>
                  {durMin != null && (
                    <span className="text-xs text-muted-foreground">~{durMin}m</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
