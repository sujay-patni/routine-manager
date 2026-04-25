"use client";

import { useTransition, useState, useRef } from "react";
import { setEventCompleted } from "@/app/actions/events";
import type { TodayEvent } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: TodayEvent;
  onDoneChange?: (id: string, done: boolean) => void;
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

export default function EventCard({ event, onDoneChange, onEdit, onView }: EventCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localDone, setLocalDone] = useState(event.is_completed);
  const [showDurationPunch, setShowDurationPunch] = useState(false);
  const [durationInput, setDurationInput] = useState("");
  const durationRef = useRef<HTMLInputElement>(null);

  const isDeadline = event.event_type === "deadline";
  const isAllDay = event.event_type === "all_day";

  function dispatchComplete(durationActual?: number) {
    setLocalDone(true);
    onDoneChange?.(event.id, true);
    startTransition(async () => {
      await setEventCompleted(event.id, true, durationActual);
    });
  }

  function toggleComplete() {
    if (localDone) {
      // Uncompleting
      setLocalDone(false);
      setShowDurationPunch(false);
      onDoneChange?.(event.id, false);
      startTransition(async () => {
        await setEventCompleted(event.id, false);
      });
      return;
    }

    const defaultDur = computeDefaultDuration(event);
    if (defaultDur != null) {
      setDurationInput(String(defaultDur));
      setShowDurationPunch(true);
      setTimeout(() => durationRef.current?.focus(), 50);
    } else {
      dispatchComplete();
    }
  }

  function saveDuration() {
    const val = parseInt(durationInput, 10);
    setShowDurationPunch(false);
    dispatchComplete(isNaN(val) || val <= 0 ? undefined : val);
  }

  function skipDuration() {
    setShowDurationPunch(false);
    dispatchComplete();
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

  const defaultDur = computeDefaultDuration(event);
  const icon = isDeadline
    ? event.isOverdue ? "🔴" : "⏰"
    : isAllDay ? "📋"
    : "📅";

  return (
    <div
      onClick={showDurationPunch ? undefined : onView}
      className={cn(
        "flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated transition-all",
        localDone && !showDurationPunch && "opacity-50",
        isDeadline && event.isOverdue && "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
        isDeadline && !event.isOverdue && event.daysUntilDue === 0 && "border-orange-200 dark:border-orange-900",
        isPending && "opacity-70",
        onView && !showDurationPunch && "cursor-pointer"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete button */}
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{icon}</span>
            <span className={cn("font-semibold text-sm", localDone && !showDurationPunch && "line-through text-muted-foreground")}>
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

      {/* Duration punch form */}
      {showDurationPunch && (
        <form
          onSubmit={(e) => { e.preventDefault(); saveDuration(); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 ml-9 flex items-center gap-2"
        >
          <span className="text-xs text-muted-foreground">⏱</span>
          <input
            ref={durationRef}
            type="number"
            min="1"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            className="w-16 text-sm border rounded-md px-2 py-1 bg-background"
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
            onClick={skipDuration}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
          >
            Skip
          </button>
        </form>
      )}
    </div>
  );
}
