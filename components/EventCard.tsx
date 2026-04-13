"use client";

import { useOptimistic, useTransition } from "react";
import { completeEvent, updateEventProgress } from "@/app/actions/events";
import type { TodayEvent } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import ProgressInput from "@/components/ProgressInput";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: TodayEvent;
  onRemove?: (id: string) => void;
}

const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function EventCard({ event, onRemove }: EventCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(event.is_completed);
  const [optimisticProgress, setOptimisticProgress] = useOptimistic(event.progress_value ?? 0);

  const isDeadline = event.event_type === "deadline";
  const isAllDay = event.event_type === "all_day";
  const hasProgress = event.progress_metric != null && event.progress_target != null;

  function complete() {
    if (optimisticDone) return;
    startTransition(async () => {
      setOptimisticDone(true);
      await completeEvent(event.id);
    });
  }

  function handleProgressUpdate(value: number) {
    startTransition(async () => {
      setOptimisticProgress(value);
      const autoComplete = event.progress_target != null && value >= event.progress_target;
      await updateEventProgress(event.id, value, autoComplete);
      if (autoComplete) setOptimisticDone(true);
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
        optimisticDone && "opacity-50",
        isDeadline && event.isOverdue && "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
        isDeadline && !event.isOverdue && event.daysUntilDue === 0 && "border-orange-200 dark:border-orange-900",
        isPending && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete button */}
        {!hasProgress && (
          <button
            onClick={complete}
            disabled={optimisticDone || isPending}
            className={cn(
              "mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
              optimisticDone
                ? "bg-emerald-500 border-emerald-500"
                : "border-muted-foreground/40 hover:border-primary active:scale-90"
            )}
          >
            {optimisticDone && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Progress circle */}
        {hasProgress && (
          <div
            className={cn(
              "mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              optimisticDone ? "bg-emerald-500 border-emerald-500" : "border-primary/40"
            )}
          >
            {optimisticDone && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{icon}</span>
            <span className={cn("font-semibold text-sm", optimisticDone && "line-through text-muted-foreground")}>
              {event.title}
            </span>
            {event.is_recurring && (
              <span className="text-xs text-muted-foreground">↺</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{getSubtitle()}</p>
        </div>

        {/* Badges + remove */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isDeadline && event.isOverdue && (
            <Badge variant="destructive" className="text-xs">overdue</Badge>
          )}
          {isDeadline && !event.isOverdue && event.daysUntilDue === 0 && (
            <Badge className="bg-orange-500 text-white text-xs">due today</Badge>
          )}
          {onRemove && !optimisticDone && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(event.id); }}
              className="text-muted-foreground/50 hover:text-destructive text-lg leading-none transition-colors"
              title="Remove from today"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {hasProgress && (
        <ProgressInput
          metric={event.progress_metric!}
          target={event.progress_target!}
          current={optimisticProgress}
          onUpdate={handleProgressUpdate}
          disabled={isPending || optimisticDone}
          className="pl-9"
        />
      )}
    </div>
  );
}
