"use client";

import { useTransition, useState, useRef } from "react";
import { completeHabit, uncompleteHabit, logHabitProgress } from "@/app/actions/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSwipeReveal } from "@/lib/useSwipeReveal";
import type { Group } from "@/lib/notion/types";

interface HabitCardProps {
  habit: ProcessedHabit;
  today: string;
  groups?: Group[];
  onDoneChange?: (id: string, done: boolean) => void;
  onToggle?: (id: string, done: boolean, serverFn: () => Promise<void>) => void;
  onSkip?: () => void;
  onUnskip?: () => void;
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
  skipped: { badge: null, cardClass: "opacity-65", checkClass: "" },
  pending: { badge: null, cardClass: "", checkClass: "" },
  urgent: { badge: null, cardClass: "border-orange-200 dark:border-orange-900", checkClass: "" },
  optional: { badge: { label: "optional", className: "" }, cardClass: "opacity-75", checkClass: "" },
  satisfied: { badge: { label: "week done ✓", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" }, cardClass: "opacity-65", checkClass: "" },
};

const TIME_UNITS = new Set(["mins", "hrs"]);

function isTimeUnit(unit: string | null | undefined): boolean {
  return unit != null && TIME_UNITS.has(unit.toLowerCase());
}

function progressToMinutes(value: number, unit: string | null | undefined, conversion: number | null | undefined): number {
  if (!unit) return Math.round(value);
  const u = unit.toLowerCase();
  if (u === "hrs") return Math.round(value * 60);
  if (u === "mins") return Math.round(value);
  return Math.round(value * (conversion ?? 1));
}

export default function HabitCard({ habit, today, groups, onDoneChange, onToggle, onSkip, onUnskip, onEdit, onView }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localDone, setLocalDone] = useState(habit.completed_today > 0);
  const [localProgress, setLocalProgress] = useState(habit.today_progress ?? 0);
  const [localContribution, setLocalContribution] = useState(habit.today_contribution ?? 0);
  const [progressEditing, setProgressEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(habit.today_contribution ?? 0));
  const [timeInputVal, setTimeInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Log time (swipe flow)
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeInput, setLogTimeInput] = useState("");
  const logTimeRef = useRef<HTMLInputElement>(null);

  const { translateX, isSnapping, close: closeSwipe, handlers: swipeHandlers, actionWidth } = useSwipeReveal();

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
  const timeBased = isTimeUnit(habit.progress_metric);

  function toggle() {
    if (hasProgress) return;
    const newDone = !localDone;
    setLocalDone(newDone);
    onDoneChange?.(habit.id, newDone);
    // Immediately complete using default duration — no punch prompt
    dispatchToggle(newDone, newDone ? (habit.duration_minutes ?? undefined) : undefined);
  }

  function dispatchToggle(newDone: boolean, durationActual: number | undefined) {
    const serverFn = async () => {
      if (newDone) await completeHabit(habit.id, today, habit.name, durationActual);
      else await uncompleteHabit(habit.id, today);
    };
    if (onToggle) {
      onToggle(habit.id, newDone, serverFn);
    } else {
      startTransition(serverFn);
    }
  }

  function openLogTime() {
    closeSwipe();
    setLogTimeInput(habit.duration_minutes != null ? String(habit.duration_minutes) : "");
    setLogTimeOpen(true);
    setTimeout(() => logTimeRef.current?.focus(), 80);
  }

  function saveLogTime(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const val = Number(logTimeInput);
    const duration = !isNaN(val) && val > 0 ? val : undefined;
    setLogTimeOpen(false);
    // Mark done with custom duration
    if (!localDone) {
      setLocalDone(true);
      onDoneChange?.(habit.id, true);
    }
    dispatchToggle(true, duration);
  }

  function cancelLogTime() {
    setLogTimeOpen(false);
  }

  function openProgressEditor(e: React.MouseEvent) {
    e.stopPropagation();
    setInputVal(String(localContribution));
    if (!timeBased) {
      const prefill = progressToMinutes(localContribution, habit.progress_metric, habit.progress_conversion);
      setTimeInputVal(prefill > 0 ? String(prefill) : "");
    }
    setProgressEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function submitProgress(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const raw = Math.max(0, Math.min((habit.progress_target ?? 0) * 2, Number(inputVal) || 0));
    const newContrib = Math.round(raw * 100) / 100;
    const newPeriodTotal = localProgress - localContribution + newContrib;
    setLocalProgress(newPeriodTotal);
    setLocalContribution(newContrib);
    setProgressEditing(false);
    const nowDone = habit.progress_target != null && newPeriodTotal >= habit.progress_target;
    onDoneChange?.(habit.id, nowDone);

    let durationActual: number | undefined;
    if (timeBased) {
      durationActual = progressToMinutes(newContrib, habit.progress_metric, habit.progress_conversion);
    } else if (timeInputVal !== "") {
      const t = Number(timeInputVal);
      if (!isNaN(t) && t > 0) durationActual = Math.round(t);
    }

    startTransition(async () => {
      const result = await logHabitProgress(habit.id, today, habit.name, newContrib, durationActual);
      if (result?.error) {
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
  const isSkipped = habit.is_skipped === true;

  const weeklyProgress =
    habit.frequency === "weekly" || habit.frequency === "specific_days_weekly"
      ? `${habit.completions_this_week}/${habit.target}`
      : null;

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

  // Swipe available for all non-done, non-progress habits
  const swipeEnabled = !hasProgress && !effectiveDone && !isSkipped;
  const canSkip = !effectiveDone && !isSkipped && !!onSkip;

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
          "w-full flex flex-col gap-0 p-4 rounded-2xl border bg-card card-elevated text-left",
          isSnapping && "transition-transform duration-200 ease-out",
          config.cardClass,
          isPending && "opacity-70",
          onView && !logTimeOpen && "cursor-pointer"
        )}
        style={{
          ...(swipeEnabled ? { transform: `translateX(-${translateX}px)` } : {}),
          ...(groupColor ? { borderLeftWidth: "3px", borderLeftColor: groupColor } : {}),
        }}
      >
        <div className="flex items-center gap-3">
          {/* Circle checkbox (non-progress only) */}
          {!hasProgress && !isSkipped && (
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
          {isSkipped && (
            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center flex-shrink-0 text-muted-foreground/60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l10 8-10 8V4zM19 5v14" />
              </svg>
            </div>
          )}

          {/* Name + labels */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("font-semibold text-sm", (effectiveDone || isSkipped) && "line-through text-muted-foreground")}>
                {habit.name}
              </span>
              {timeLabel && <span className="text-xs text-muted-foreground">· {timeLabel}</span>}
              {!hasProgress && habit.duration_minutes != null && (
                <span className="text-xs text-muted-foreground">· ~{habit.duration_minutes}m</span>
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

          {/* Log time button (desktop hover) */}
          {swipeEnabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openLogTime(); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
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
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors flex-shrink-0"
              aria-label="Skip habit"
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
          {hasProgress && !isProgressDone && !isSkipped && (
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
              {isProgressDone && <span className="text-xs text-emerald-600 font-medium">Done ✓</span>}
            </div>
            <Progress value={progressPct} className={cn("h-1.5", isProgressDone && "[&>div]:bg-emerald-500")} />
          </div>
        )}

        {/* Inline progress editor */}
        {progressEditing && (
          <form
            onSubmit={submitProgress}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/50"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="number"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (!timeBased) {
                    const v = Number(e.target.value) || 0;
                    setTimeInputVal(String(progressToMinutes(v, habit.progress_metric, habit.progress_conversion) || ""));
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Escape") setProgressEditing(false); }}
                step="0.01"
                min={0}
                className="w-24 text-sm border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground flex-1">{habit.progress_metric} today</span>
              <button
                type="button"
                onClick={() => setProgressEditing(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Cancel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="submit"
                className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                aria-label="Save progress"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
            {/* Time field for non-time units */}
            {!timeBased && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">⏱</span>
                <input
                  type="number"
                  value={timeInputVal}
                  onChange={(e) => setTimeInputVal(e.target.value)}
                  min={0}
                  placeholder="min"
                  className="w-20 text-sm border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">min (optional)</span>
              </div>
            )}
          </form>
        )}

        {/* Log time inline form (from swipe action) */}
        {logTimeOpen && (
          <form
            onSubmit={saveLogTime}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50"
          >
            <span className="text-xs text-muted-foreground">⏱</span>
            <input
              ref={logTimeRef}
              type="number"
              value={logTimeInput}
              onChange={(e) => setLogTimeInput(e.target.value)}
              min={0}
              placeholder="min"
              className="w-20 text-sm border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground flex-1">min</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancelLogTime(); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
            >
              Save
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
