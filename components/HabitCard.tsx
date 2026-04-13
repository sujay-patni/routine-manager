"use client";

import { useOptimistic, useTransition, useState } from "react";
import { completeHabit, uncompleteHabit, logHabitProgress } from "@/app/actions/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import { Badge } from "@/components/ui/badge";
import ProgressInput from "@/components/ProgressInput";
import { cn } from "@/lib/utils";

interface HabitCardProps {
  habit: ProcessedHabit;
  today: string;
}

const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

const stateConfig = {
  done: { badge: null, cardClass: "opacity-65", checkClass: "bg-emerald-500 border-emerald-500" },
  pending: { badge: null, cardClass: "", checkClass: "" },
  urgent: { badge: { label: "do today", className: "bg-orange-500 text-white" }, cardClass: "border-orange-200 dark:border-orange-900", checkClass: "" },
  at_risk: { badge: { label: "at risk", className: "bg-destructive text-destructive-foreground" }, cardClass: "border-red-200 dark:border-red-900", checkClass: "" },
  optional: { badge: { label: "optional", className: "" }, cardClass: "opacity-75", checkClass: "" },
  satisfied: { badge: { label: "week done ✓", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" }, cardClass: "opacity-65", checkClass: "" },
};

export default function HabitCard({ habit, today }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(habit.completed_today > 0);
  const [optimisticProgress, setOptimisticProgress] = useOptimistic(habit.today_progress ?? 0);

  const hasProgress = habit.progress_metric != null && habit.progress_target != null;

  function toggle() {
    if (hasProgress) return; // Progress habits use ProgressInput
    startTransition(async () => {
      setOptimisticDone(!optimisticDone);
      if (optimisticDone) {
        await uncompleteHabit(habit.id, today);
      } else {
        await completeHabit(habit.id, today, habit.name);
      }
    });
  }

  function handleProgressUpdate(value: number) {
    startTransition(async () => {
      setOptimisticProgress(value);
      await logHabitProgress(habit.id, today, habit.name, value);
    });
  }

  const config = stateConfig[habit.state];
  const isProgressDone = hasProgress && optimisticProgress >= (habit.progress_target ?? 0);
  const effectiveDone = hasProgress ? isProgressDone : optimisticDone;

  const weeklyProgress =
    habit.frequency === "weekly" || habit.frequency === "specific_days_weekly"
      ? `${habit.completions_this_week}/${habit.target}`
      : null;

  // Time label to show
  const timeLabel = habit.exact_time
    ? (() => {
        const [h, m] = habit.exact_time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
      })()
    : habit.time_of_day
    ? TIME_OF_DAY_LABEL[habit.time_of_day]
    : null;

  return (
    <div
      className={cn(
        "w-full flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated text-left transition-all",
        config.cardClass,
        isPending && "opacity-70"
      )}
      style={{ borderLeftWidth: "4px", borderLeftColor: habit.color }}
    >
      <div className="flex items-center gap-3">
        {/* Circle checkbox (only for non-progress habits) */}
        {!hasProgress && (
          <button
            onClick={toggle}
            disabled={isPending}
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
              effectiveDone
                ? "bg-emerald-500 border-emerald-500"
                : "border-muted-foreground/40 hover:border-primary active:scale-90"
            )}
          >
            {effectiveDone && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Progress circle indicator */}
        {hasProgress && (
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
              isProgressDone ? "bg-emerald-500 border-emerald-500" : "border-primary/40"
            )}
          >
            {isProgressDone && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}

        {/* Icon + name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base leading-none">{habit.icon}</span>
            <span className={cn("font-semibold text-sm", effectiveDone && "line-through text-muted-foreground")}>
              {habit.name}
            </span>
            {timeLabel && (
              <span className="text-xs text-muted-foreground">· {timeLabel}</span>
            )}
          </div>
          {weeklyProgress && (
            <p className="text-xs text-muted-foreground mt-0.5">{weeklyProgress} this week</p>
          )}
        </div>

        {/* State badge */}
        {config.badge && (
          <Badge className={cn("text-xs flex-shrink-0 font-medium", config.badge.className)}>
            {config.badge.label}
          </Badge>
        )}
      </div>

      {/* Progress bar (for progress-tracked habits) */}
      {hasProgress && (
        <ProgressInput
          metric={habit.progress_metric!}
          target={habit.progress_target!}
          start={habit.progress_start ?? 0}
          current={optimisticProgress}
          onUpdate={handleProgressUpdate}
          disabled={isPending}
          className="pl-9"
        />
      )}
    </div>
  );
}
