"use client";

import { useTransition, useState, useRef } from "react";
import { setEventCompleted } from "@/app/actions/events";
import type { TodayEvent } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSwipeReveal } from "@/lib/useSwipeReveal";

interface EventCardProps {
  event: TodayEvent;
  onDoneChange?: (id: string, done: boolean) => void;
  onSkip?: () => void;
  onUnskip?: () => void;
  onEdit?: () => void;
  onView?: () => void;
}

const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const d = new Date(timeStr);
  let h, m;
  if (!isNaN(d.getTime())) {
    h = d.getHours();
    m = d.getMinutes();
  } else {
    const timePart = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
    const parts = timePart.split(":").map(Number);
    h = parts[0];
    m = parts[1] || 0;
  }
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function computeDefaultDuration(event: TodayEvent): number | null {
  if (event.duration_minutes != null) return event.duration_minutes;
  if (event.event_type === "timed" && event.start_time && event.end_time) {
    const diff = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
    if (diff > 0) return Math.round(diff / 60000);
  }
  return null;
}

export default function EventCard({ event, onDoneChange, onSkip, onUnskip, onEdit, onView }: EventCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localDone, setLocalDone] = useState(event.is_completed);
  const isSkipped = event.is_skipped === true;

  // Log time (swipe flow)
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeInput, setLogTimeInput] = useState("");
  const logTimeRef = useRef<HTMLInputElement>(null);

  const { translateX, isSnapping, close: closeSwipe, handlers: swipeHandlers, actionWidth } = useSwipeReveal();

  const isDeadline = event.event_type === "deadline";
  const isAllDay = event.event_type === "all_day";
  const defaultDur = computeDefaultDuration(event);

  // Swipe available for all non-done events
  const swipeEnabled = !localDone && !isSkipped;
  const canSkip = !localDone && !isSkipped && !!onSkip;

  function dispatchComplete(durationActual?: number) {
    setLocalDone(true);
    onDoneChange?.(event.id, true);
    startTransition(async () => {
      await setEventCompleted(event.id, true, durationActual);
    });
  }

  function toggleComplete() {
    if (localDone) {
      setLocalDone(false);
      onDoneChange?.(event.id, false);
      startTransition(async () => {
        await setEventCompleted(event.id, false);
      });
      return;
    }
    // Immediately complete using default duration — no punch prompt
    dispatchComplete(defaultDur ?? undefined);
  }

  function openLogTime() {
    closeSwipe();
    setLogTimeInput(defaultDur != null ? String(defaultDur) : "");
    setLogTimeOpen(true);
    setTimeout(() => logTimeRef.current?.focus(), 80);
  }

  function saveLogTime(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const val = parseInt(logTimeInput, 10);
    setLogTimeOpen(false);
    dispatchComplete(isNaN(val) || val <= 0 ? undefined : val);
  }

  function cancelLogTime() {
    setLogTimeOpen(false);
  }

  function getSubtitle(): string {
    if (event.event_type === "timed") {
      const start = formatTime(event.start_time);
      const end = event.end_time ? ` – ${formatTime(event.end_time)}` : "";
      return start + end;
    }
    if (isAllDay) {
      if (event.due_time) {
        const [h, m] = event.due_time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
      }
      if (event.time_of_day) return TIME_OF_DAY_LABEL[event.time_of_day] ?? "All day";
      return "All day";
    }
    if (isDeadline) {
      if (event.isOverdue) {
        const days = Math.abs(event.daysUntilDue ?? 0);
        return `Overdue by ${days} day${days !== 1 ? "s" : ""}`;
      }
      if (event.daysUntilDue === 0) return "Due today";
      return `Due in ${event.daysUntilDue} day${event.daysUntilDue !== 1 ? "s" : ""}`;
    }
    return "";
  }

  const icon = isDeadline
    ? event.isOverdue ? "🔴" : "⏰"
    : isAllDay ? "📋"
    : "📅";

  return (
    <div className="group relative overflow-hidden rounded-2xl">
      {/* Action strip revealed on swipe */}
      {swipeEnabled && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-r-2xl"
          style={{ width: actionWidth }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openLogTime(); }}
            className="flex flex-col items-center gap-0.5 text-blue-600 dark:text-blue-400 px-2"
          >
            <span className="text-base">⏱</span>
            <span className="text-[10px] font-semibold leading-tight">Log time</span>
          </button>
        </div>
      )}

      {/* Sliding card */}
      <div
        {...(swipeEnabled ? swipeHandlers : {})}
        onClick={logTimeOpen ? undefined : onView}
        className={cn(
          "flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated transition-all",
          isSnapping && "transition-transform duration-200 ease-out",
          (localDone || isSkipped) && "opacity-50",
          isDeadline && event.isOverdue && "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
          isDeadline && !event.isOverdue && event.daysUntilDue === 0 && "border-orange-200 dark:border-orange-900",
          isPending && "opacity-70",
          onView && !logTimeOpen && "cursor-pointer"
        )}
        style={swipeEnabled ? { transform: `translateX(-${translateX}px)` } : undefined}
      >
        <div className="flex items-start gap-3">
          {/* Complete button */}
          {!isSkipped && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleComplete(); }}
              disabled={isPending}
              className={cn(
                "mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                localDone
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-muted-foreground/40 hover:border-primary active:scale-90"
              )}
              aria-label={localDone ? "Mark incomplete" : "Mark complete"}
            >
              {localDone && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          {isSkipped && (
            <div className="mt-0.5 w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center flex-shrink-0 text-muted-foreground/60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l10 8-10 8V4zM19 5v14" />
              </svg>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base leading-none">{icon}</span>
              <span className={cn("font-semibold text-sm", (localDone || isSkipped) && "line-through text-muted-foreground")}>
                {event.title}
              </span>
              {event.is_recurring && (
                <span className="text-xs text-muted-foreground">↺</span>
              )}
              {defaultDur != null && !localDone && (
                <span className="text-xs text-muted-foreground/60">~{defaultDur}m</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{getSubtitle()}</p>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isDeadline && event.isOverdue && (
              <Badge variant="destructive" className="text-xs">overdue</Badge>
            )}
            {isDeadline && !event.isOverdue && event.daysUntilDue === 0 && (
              <Badge className="bg-orange-500 text-white text-xs">due today</Badge>
            )}
            {/* Log time button (desktop hover) */}
            {swipeEnabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openLogTime(); }}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Log time"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
            )}
            {canSkip && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSkip?.(); }}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                aria-label="Skip"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l10 8-10 8V4zM19 5v14" />
                </svg>
              </button>
            )}
            {isSkipped && onUnskip && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUnskip(); }}
                className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
              >
                Undo
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Log time inline form (from swipe action) */}
        {logTimeOpen && (
          <form
            onSubmit={saveLogTime}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 ml-9 flex items-center gap-2"
          >
            <span className="text-xs text-muted-foreground">⏱</span>
            <input
              ref={logTimeRef}
              type="number"
              min="1"
              value={logTimeInput}
              onChange={(e) => setLogTimeInput(e.target.value)}
              className="w-16 text-sm border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">min</span>
            <button
              type="submit"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelLogTime}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
