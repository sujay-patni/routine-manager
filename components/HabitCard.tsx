"use client";

import { useTransition, useState } from "react";
import { completeHabit, uncompleteHabit, logHabitProgress } from "@/app/actions/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useRef } from "react";

import type { Group } from "@/lib/notion/types";

interface HabitCardProps {
  habit: ProcessedHabit;
  today: string;
  groups?: Group[];
  onDoneChange?: (id: string, done: boolean) => void;
  onToggle?: (id: string, done: boolean, serverFn: () => Promise<void>) => void;
  onEdit?: () => void;
  onView?: () => void;
}

const PERIOD_LABELS: Record<string, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
};

const stateConfig = {
  done: { badge: null, cardClass: "opacity-65", checkClass: "bg-emerald-500 border-emerald-500" },
  pending: { badge: null, cardClass: "", checkClass: "" },
  urgent: { badge: null, cardClass: "border-orange-200 dark:border-orange-900", checkClass: "" },
  optional: { badge: { label: "optional", className: "" }, cardClass: "opacity-75", checkClass: "" },
  satisfied: { badge: { label: "week done ✓", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" }, cardClass: "opacity-65", checkClass: "" },
};

export default function HabitCard({ habit, today, groups, onDoneChange, onToggle, onEdit, onView }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localDone, setLocalDone] = useState(habit.completed_today > 0);
  // Period total (for display in progress bar)
  const [localProgress, setLocalProgress] = useState(habit.today_progress ?? 0);
  // Today's individual contribution (pre-fills the inline editor)
  const [localContribution, setLocalContribution] = useState(habit.today_contribution ?? 0);
  const [progressEditing, setProgressEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(habit.today_contribution ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state if date changes or server returns updated data
  const [prevTodayStr, setPrevTodayStr] = useState(today);
  const [prevBaseCount, setPrevBaseCount] = useState(habit.completed_today);
  if (today !== prevTodayStr || habit.completed_today !== prevBaseCount) {
    setPrevTodayStr(today);
    setPrevBaseCount(habit.completed_today);
    setLocalDone(habit.completed_today > 0);
    setLocalProgress(habit.today_progress ?? 0);
    setLocalContribution(habit.today_contribution ?? 0);
    setInputVal(String(habit.today_contribution ?? 0));
  }

  const hasProgress = habit.progress_metric != null && habit.progress_target != null;

  function toggle() {
    if (hasProgress) return;
    const newDone = !localDone;
    setLocalDone(newDone);
    onDoneChange?.(habit.id, newDone);
    const serverFn = async () => {
      if (newDone) await completeHabit(habit.id, today, habit.name);
      else await uncompleteHabit(habit.id, today);
    };
    if (onToggle) {
      onToggle(habit.id, newDone, serverFn);
    } else {
      startTransition(serverFn);
    }
  }

  function openProgressEditor(e: React.MouseEvent) {
    e.stopPropagation();
    setInputVal(String(localContribution)); // pre-fill with today's contribution, not period total
    setProgressEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function submitProgress(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const raw = Math.max(
      0,
      Math.min((habit.progress_target ?? 0) * 2, Number(inputVal) || 0)
    );
    const newContrib = Math.round(raw * 100) / 100;
    // Optimistic: period total = old_total - old_contribution + new_contribution
    const newPeriodTotal = localProgress - localContribution + newContrib;
    setLocalProgress(newPeriodTotal);
    setLocalContribution(newContrib);
    setProgressEditing(false);
    const nowDone = habit.progress_target != null && newPeriodTotal >= habit.progress_target;
    onDoneChange?.(habit.id, nowDone);
    startTransition(async () => {
      const result = await logHabitProgress(habit.id, today, habit.name, newContrib);
      if (result?.error) {
        // Revert on error
        setLocalProgress(habit.today_progress ?? 0);
        setLocalContribution(habit.today_contribution ?? 0);
        onDoneChange?.(habit.id, habit.progress_target != null && (habit.today_progress ?? 0) >= habit.progress_target);
      }
    });
  }

  const config = stateConfig[habit.state];
  const groupColor = groups?.find((g) => g.id === habit.group_id)?.color ?? null;
  const isProgressDone = hasProgress && localProgress >= (habit.progress_target ?? 0);
  const effectiveDone = hasProgress ? isProgressDone : localDone;

  const weeklyProgress =
    habit.frequency === "weekly" || habit.frequency === "specific_days_weekly"
      ? `${habit.completions_this_week}/${habit.target}`
      : null;

  // Only show a time label for exact_time (e.g. "9:00 AM") — not for time_of_day
  // since the parent section heading already says "Morning", "Evening", etc.
  const timeLabel = habit.exact_time
    ? (() => {
        const [h, m] = habit.exact_time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
      })()
    : null;

  const progressRange = (habit.progress_target ?? 0) - (habit.progress_start ?? 0);
  const progressPct = progressRange > 0
    ? Math.min(100, ((localProgress - (habit.progress_start ?? 0)) / progressRange) * 100)
    : 0;

  const periodLabel = PERIOD_LABELS[habit.progress_period ?? "daily"] ?? "today";

  return (
    <div
      onClick={onView}
      className={cn(
        "w-full flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated text-left transition-all",
        config.cardClass,
        isPending && "opacity-70",
        onView && "cursor-pointer"
      )}
      style={groupColor ? { borderLeftWidth: "3px", borderLeftColor: groupColor } : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Circle checkbox (non-progress habits only) */}
        {!hasProgress && (
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
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

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
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

        {/* Edit button */}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Edit habit"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}

        {/* Progress "+" button */}
        {hasProgress && !isProgressDone && (
          <button
            onClick={openProgressEditor}
            disabled={isPending}
            className="w-7 h-7 rounded-full border-2 border-primary/40 flex items-center justify-center flex-shrink-0 text-primary hover:bg-primary/10 active:scale-90 transition-all"
            aria-label="Log progress"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Progress done checkmark */}
        {hasProgress && isProgressDone && (
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {hasProgress && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {localProgress} / {habit.progress_target} {habit.progress_metric}
              {habit.progress_period && habit.progress_period !== "daily" && (
                <span className="ml-1 opacity-70">{periodLabel}</span>
              )}
            </span>
            {isProgressDone && (
              <span className="text-xs text-emerald-600 font-medium">Done ✓</span>
            )}
          </div>
          <Progress
            value={progressPct}
            className={cn("h-1.5", isProgressDone && "[&>div]:bg-emerald-500")}
          />
        </div>
      )}

      {/* Inline progress editor */}
      {progressEditing && (
        <form
          onSubmit={submitProgress}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50"
        >
          <input
            ref={inputRef}
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setProgressEditing(false); }}
            step="0.01"
            min={0}
            className="w-24 text-sm border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground flex-1">
            {habit.progress_metric} today
          </span>
          <button
            type="button"
            onClick={() => setProgressEditing(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Cancel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="submit"
            className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
            aria-label="Save progress"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
