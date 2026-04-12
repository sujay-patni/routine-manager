"use client";

import { useOptimistic, useTransition } from "react";
import { completeHabit, uncompleteHabit } from "@/app/actions/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HabitCardProps {
  habit: ProcessedHabit;
  today: string;
}

const stateConfig = {
  done: { badge: null, cardClass: "opacity-60", checkClass: "bg-green-500 border-green-500" },
  pending: { badge: null, cardClass: "", checkClass: "" },
  urgent: { badge: { label: "do today", variant: "default" as const, className: "bg-orange-500" }, cardClass: "border-orange-200", checkClass: "" },
  at_risk: { badge: { label: "at risk", variant: "destructive" as const, className: "" }, cardClass: "border-red-200", checkClass: "" },
  optional: { badge: { label: "optional", variant: "secondary" as const, className: "" }, cardClass: "opacity-80", checkClass: "" },
  satisfied: { badge: { label: "done for week", variant: "secondary" as const, className: "bg-green-100 text-green-700" }, cardClass: "opacity-60", checkClass: "" },
};

export default function HabitCard({ habit, today }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    habit.completed_today > 0
  );

  const config = stateConfig[habit.state];

  function toggle() {
    startTransition(async () => {
      setOptimisticDone(!optimisticDone);
      if (optimisticDone) {
        await uncompleteHabit(habit.id, today);
      } else {
        await completeHabit(habit.id, today);
      }
    });
  }

  const weeklyProgress =
    habit.frequency === "weekly"
      ? `${habit.completions_this_week}/${habit.target}`
      : null;

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-xl border bg-card text-left transition-all active:scale-[0.98]",
        config.cardClass,
        isPending && "opacity-70 pointer-events-none"
      )}
      style={{ borderLeftWidth: "4px", borderLeftColor: habit.color }}
    >
      {/* Circle checkbox */}
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
          optimisticDone
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground/40",
          config.checkClass
        )}
      >
        {optimisticDone && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Icon + name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{habit.icon}</span>
          <span className={cn("font-medium truncate", optimisticDone && "line-through text-muted-foreground")}>
            {habit.name}
          </span>
        </div>
        {weeklyProgress && (
          <p className="text-xs text-muted-foreground mt-0.5">{weeklyProgress} this week</p>
        )}
      </div>

      {/* State badge */}
      {config.badge && (
        <Badge variant={config.badge.variant} className={cn("text-xs flex-shrink-0", config.badge.className)}>
          {config.badge.label}
        </Badge>
      )}
    </button>
  );
}
