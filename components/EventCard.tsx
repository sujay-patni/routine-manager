"use client";

import { useOptimistic, useTransition } from "react";
import { completeEvent } from "@/app/actions/events";
import type { TodayEvent } from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: TodayEvent;
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function EventCard({ event }: EventCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(event.is_completed);

  function complete() {
    if (optimisticDone) return;
    startTransition(async () => {
      setOptimisticDone(true);
      await completeEvent(event.id);
    });
  }

  const isDeadline = event.event_type === "deadline";
  const isAllDay = event.event_type === "all_day";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border bg-card transition-all",
        optimisticDone && "opacity-50",
        isDeadline && event.isOverdue && "border-red-200 bg-red-50/50",
        isDeadline && !event.isOverdue && event.daysUntilDue === 0 && "border-orange-200"
      )}
    >
      {/* Complete button */}
      <button
        onClick={complete}
        disabled={optimisticDone || isPending}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
          optimisticDone ? "bg-green-500 border-green-500" : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {optimisticDone && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isDeadline && <span className="text-base">{event.isOverdue ? "🔴" : "⏰"}</span>}
          {isAllDay && <span className="text-base">📋</span>}
          {event.event_type === "timed" && <span className="text-base">📅</span>}
          <span className={cn("font-medium truncate", optimisticDone && "line-through")}>
            {event.title}
          </span>
          {event.is_recurring && (
            <span className="text-xs text-muted-foreground">↺</span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          {event.event_type === "timed" && formatTime(event.start_time)}
          {isAllDay && "All day"}
          {isDeadline && (
            event.isOverdue
              ? `Overdue by ${Math.abs(event.daysUntilDue ?? 0)} day${Math.abs(event.daysUntilDue ?? 0) !== 1 ? "s" : ""}`
              : event.daysUntilDue === 0
              ? "Due today"
              : `Due in ${event.daysUntilDue} day${event.daysUntilDue !== 1 ? "s" : ""}`
          )}
        </p>
      </div>

      {/* Badge */}
      {isDeadline && event.isOverdue && (
        <Badge variant="destructive" className="text-xs flex-shrink-0">overdue</Badge>
      )}
      {isDeadline && !event.isOverdue && event.daysUntilDue === 0 && (
        <Badge className="bg-orange-500 text-xs flex-shrink-0">due today</Badge>
      )}
    </div>
  );
}
