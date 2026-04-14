"use client";

import { useTransition, useState } from "react";
import { setEventCompleted } from "@/app/actions/events";
import type { TodayEvent } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: TodayEvent;
  onDoneChange?: (id: string, done: boolean) => void;
  onEdit?: () => void;
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

export default function EventCard({ event, onDoneChange, onEdit }: EventCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localDone, setLocalDone] = useState(event.is_completed);

  const isDeadline = event.event_type === "deadline";
  const isAllDay = event.event_type === "all_day";

  function toggleComplete() {
    const nextDone = !localDone;
    setLocalDone(nextDone);
    onDoneChange?.(event.id, nextDone);
    startTransition(async () => {
      await setEventCompleted(event.id, nextDone);
    });
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
    <div
      className={cn(
        "flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated transition-all",
        localDone && "opacity-50",
        isDeadline && event.isOverdue && "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
        isDeadline && !event.isOverdue && event.daysUntilDue === 0 && "border-orange-200 dark:border-orange-900",
        isPending && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete button */}
        <button
          onClick={toggleComplete}
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
            <span className={cn("font-semibold text-sm", localDone && "line-through text-muted-foreground")}>
              {event.title}
            </span>
            {event.is_recurring && (
              <span className="text-xs text-muted-foreground">↺</span>
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
    </div>
  );
}
