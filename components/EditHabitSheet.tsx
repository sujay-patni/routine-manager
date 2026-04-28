"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateHabit, deleteHabit } from "@/app/actions/habits";
import type { Habit, HabitFrequency, Group } from "@/lib/notion/types";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { OptimisticAction } from "@/app/today/TodayClient";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/SettingsProvider";
import { useIsMobile } from "@/lib/useMediaQuery";

function isTimeUnit(unit: string) {
  return unit === "mins" || unit === "hrs";
}

interface EditHabitSheetProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchHabit?: (action: OptimisticAction<ProcessedHabit>) => void;
  onSaved?: () => void;
  groups?: Group[];
}

const DAYS_OF_WEEK = [
  { abbr: "MO", label: "Mon" },
  { abbr: "TU", label: "Tue" },
  { abbr: "WE", label: "Wed" },
  { abbr: "TH", label: "Thu" },
  { abbr: "FR", label: "Fri" },
  { abbr: "SA", label: "Sat" },
  { abbr: "SU", label: "Sun" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function EditHabitSheet({ habit, open, onOpenChange, dispatchHabit, onSaved, groups = [] }: EditHabitSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const settings = useSettings();

  // Core fields
  const [name, setName] = useState(habit?.name ?? "");
  const [desc, setDesc] = useState(habit?.description ?? "");

  // Frequency
  const [freq, setFreq] = useState<HabitFrequency>(habit?.frequency ?? "daily");
  const [weeklyTarget, setWeeklyTarget] = useState(String(habit?.weekly_target ?? 3));
  const [selectedDays, setSelectedDays] = useState<string[]>(
    habit?.specific_days && habit.frequency === "specific_days_weekly"
      ? habit.specific_days.split(",").map(d => d.trim())
      : []
  );
  const [selectedDates, setSelectedDates] = useState<string[]>(
    habit?.specific_days && habit.frequency === "specific_dates_monthly"
      ? habit.specific_days.split(",").map(d => d.trim())
      : []
  );
  const [yearlyDates, setYearlyDates] = useState<Array<{ month: string; day: string }>>(
    habit?.specific_days && habit.frequency === "specific_dates_yearly"
      ? habit.specific_days.split(",").map(s => {
          const [m, d] = s.trim().split("-");
          return { month: m, day: d };
        })
      : [{ month: "01", day: "01" }]
  );

  // Progress fields
  const [progressOn, setProgressOn] = useState(!!habit?.progress_metric);
  const [metric, setMetric] = useState(habit?.progress_metric ?? "mins");
  const [convLeft, setConvLeft] = useState(String(habit?.progress_conversion_base ?? 1));
  const [convRight, setConvRight] = useState(() => {
    const base = habit?.progress_conversion_base ?? 1;
    const rate = habit?.progress_conversion ?? 1;
    return String(Math.round(base * rate * 10000) / 10000);
  });
  const [duration, setDuration] = useState(habit?.duration_minutes != null ? String(habit.duration_minutes) : "");
  const [target, setTarget] = useState(String(habit?.progress_target ?? ""));
  const [start, setStart] = useState(String(habit?.progress_start ?? 0));
  const [progressPeriod, setProgressPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">(
    (habit?.progress_period as "daily" | "weekly" | "monthly" | "yearly") ?? "daily"
  );

  // Timing fields
  const [showExact, setShowExact] = useState(!!habit?.exact_time);
  const [timeOfDay, setTimeOfDay] = useState(habit?.time_of_day ?? "");
  const [exactTime, setExactTime] = useState(habit?.exact_time ?? "");

  // Group
  const [groupId, setGroupId] = useState(habit?.group_id ?? "");

  function resetToHabit(h: Habit | null) {
    setName(h?.name ?? "");
    setDesc(h?.description ?? "");
    setFreq(h?.frequency ?? "daily");
    setWeeklyTarget(String(h?.weekly_target ?? 3));
    setSelectedDays(
      h?.specific_days && h.frequency === "specific_days_weekly"
        ? h.specific_days.split(",").map(d => d.trim())
        : []
    );
    setSelectedDates(
      h?.specific_days && h.frequency === "specific_dates_monthly"
        ? h.specific_days.split(",").map(d => d.trim())
        : []
    );
    setYearlyDates(
      h?.specific_days && h.frequency === "specific_dates_yearly"
        ? h.specific_days.split(",").map(s => {
            const [m, d] = s.trim().split("-");
            return { month: m, day: d };
          })
        : [{ month: "01", day: "01" }]
    );
    setProgressOn(!!h?.progress_metric);
    setMetric(h?.progress_metric ?? "mins");
    const base = h?.progress_conversion_base ?? 1;
    const rate = h?.progress_conversion ?? 1;
    setConvLeft(String(base));
    setConvRight(String(Math.round(base * rate * 10000) / 10000));
    setDuration(h?.duration_minutes != null ? String(h.duration_minutes) : "");
    setTarget(String(h?.progress_target ?? ""));
    setStart(String(h?.progress_start ?? 0));
    setProgressPeriod((h?.progress_period as "daily" | "weekly" | "monthly" | "yearly") ?? "daily");
    setShowExact(!!h?.exact_time);
    setTimeOfDay(h?.time_of_day ?? "");
    setExactTime(h?.exact_time ?? "");
    setGroupId(h?.group_id ?? "");
    setError(null);
    setConfirmDelete(false);
  }

  const [prevHabit, setPrevHabit] = useState<Habit | null>(habit);
  if (habit !== prevHabit) {
    setPrevHabit(habit);
    if (habit) resetToHabit(habit);
  }

  function toggleDay(abbr: string) {
    setSelectedDays(prev => prev.includes(abbr) ? prev.filter(d => d !== abbr) : [...prev, abbr]);
  }
  function toggleDate(d: string) {
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }
  function addYearlyDate() {
    setYearlyDates(prev => [...prev, { month: "01", day: "01" }]);
  }
  function removeYearlyDate(idx: number) {
    setYearlyDates(prev => prev.filter((_, i) => i !== idx));
  }
  function updateYearlyDate(idx: number, field: "month" | "day", value: string) {
    setYearlyDates(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function getSpecificDays(): string | null {
    if (freq === "specific_days_weekly" && selectedDays.length > 0) return selectedDays.join(",");
    if (freq === "specific_dates_monthly" && selectedDates.length > 0) return selectedDates.join(",");
    if (freq === "specific_dates_yearly" && yearlyDates.length > 0) {
      return yearlyDates.map(({ month, day }) => `${month}-${String(day).padStart(2, "0")}`).join(",");
    }
    return null;
  }

  function handleDelete() {
    if (!habit) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }

    startTransition(async () => {
      if (dispatchHabit) dispatchHabit({ action: "delete", item: habit as ProcessedHabit });
      const result = await deleteHabit(habit.id);
      if (result.error) console.error("Error deleting habit:", result.error);
      else { onSaved?.(); router.refresh(); }
    });

    onOpenChange(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!habit) return;
    if (!name.trim()) { setError("Name is required"); return; }
    setError(null);

    const cLeft = Number(convLeft) || 1;
    const cRight = Number(convRight) || 1;
    const conversionVal = progressOn && !isTimeUnit(metric) ? cRight / cLeft : null;
    const payload = {
      name: name.trim(),
      description: desc || null,
      frequency: freq,
      weekly_target: freq === "weekly" && !progressOn ? Number(weeklyTarget) || 1 : null,
      specific_days: getSpecificDays(),
      progress_metric: progressOn ? metric || null : null,
      progress_target: progressOn && target ? Number(target) : null,
      progress_start: progressOn ? Number(start) : null,
      progress_period: progressOn ? progressPeriod : null,
      progress_conversion: conversionVal && !isNaN(conversionVal) ? conversionVal : null,
      progress_conversion_base: progressOn && !isTimeUnit(metric) ? cLeft : null,
      duration_minutes: duration ? Number(duration) : null,
      time_of_day: showExact ? null : (timeOfDay as Habit["time_of_day"]) || null,
      exact_time: showExact ? exactTime || null : null,
      group_id: groupId || null,
    };

    if (habit.id.startsWith("temp-")) return;

    startTransition(async () => {
      if (dispatchHabit) {
        dispatchHabit({ action: "update", item: { ...(habit as ProcessedHabit), ...payload } });
      }
      const result = await updateHabit(habit.id, payload);
      if (result.error) console.error("Error updating habit:", result.error);
      else { onSaved?.(); router.refresh(); }
    });

    onOpenChange(false);
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) resetToHabit(habit);
    onOpenChange(o);
  };

  const formContent = (
    <>
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <form onSubmit={handleSave} className="space-y-5">

        {/* Name */}
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Habit name" required />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Any notes…" rows={2} />
        </div>

        {/* Progress tracking */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Progress tracking <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <button
              type="button"
              onClick={() => setProgressOn(!progressOn)}
              className="text-xs text-primary"
            >
              {progressOn ? "Remove" : "Add"}
            </button>
          </div>
          {progressOn && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input type="number" min={0} value={start} onChange={e => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 0) val = 0;
                    setStart(String(val));
                  }} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target</Label>
                  <Input type="number" min={1} value={target} onChange={e => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 1) val = 1;
                    setTarget(String(val));
                  }} placeholder="10000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select value={metric} onValueChange={v => { if (v) { setMetric(v); setConvLeft("1"); setConvRight("1"); } }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(settings.progress_units ?? ["mins", "hrs"]).map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!isTimeUnit(metric) && (
                <div className="space-y-1">
                  <Label className="text-xs">Conversion</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={convLeft}
                      onChange={e => setConvLeft(e.target.value)}
                      placeholder="1"
                      className="w-16"
                    />
                    <span className="text-xs text-muted-foreground">{metric || "unit"} =</span>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={convRight}
                      onChange={e => setConvRight(e.target.value)}
                      placeholder="1"
                      className="w-16"
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Progress resets</Label>
                <Select value={progressPeriod} onValueChange={v => v && setProgressPeriod(v as typeof progressPeriod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly (Mon–Sun)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                    <SelectItem value="yearly">Yearly (Jan 1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={freq} onValueChange={v => v && setFreq(v as HabitFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              {!progressOn && (
                <SelectItem value="weekly">Weekly (with target)</SelectItem>
              )}
              <SelectItem value="specific_days_weekly">Specific days (weekly)</SelectItem>
              <SelectItem value="specific_dates_monthly">Specific dates (monthly)</SelectItem>
              <SelectItem value="specific_dates_yearly">Specific date (yearly)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {freq === "weekly" && !progressOn && (
          <div className="space-y-2">
            <Label>Weekly target (days)</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={weeklyTarget}
              onChange={e => setWeeklyTarget(e.target.value)}
              onBlur={() => {
                let val = parseInt(weeklyTarget, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 7) val = 7;
                setWeeklyTarget(String(val));
              }}
            />
          </div>
        )}

        {freq === "specific_days_weekly" && (
          <div className="space-y-2">
            <Label>Which days?</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map(({ abbr, label }) => (
                <button
                  key={abbr} type="button"
                  onClick={() => toggleDay(abbr)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-all",
                    selectedDays.includes(abbr)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {freq === "specific_dates_monthly" && (
          <div className="space-y-2">
            <Label>Which dates of the month?</Label>
            <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                <button
                  key={d} type="button"
                  onClick={() => toggleDate(d)}
                  className={cn(
                    "w-8 h-8 text-xs rounded-lg border font-medium transition-all",
                    selectedDates.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {freq === "specific_dates_yearly" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Which date(s) each year?</Label>
              <button
                type="button"
                onClick={addYearlyDate}
                className="w-6 h-6 rounded-full border-2 border-primary/40 flex items-center justify-center text-primary hover:bg-primary/10 transition-all"
                aria-label="Add another date"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {yearlyDates.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Select value={entry.month} onValueChange={v => v && updateYearlyDate(idx, "month", v)}>
                      <SelectTrigger>
                        <SelectValue>{MONTH_NAMES[parseInt(entry.month, 10) - 1]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={entry.day}
                      onChange={e => updateYearlyDate(idx, "day", e.target.value)}
                      placeholder="Day"
                    />
                  </div>
                  {yearlyDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeYearlyDate(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Timing <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <button
              type="button"
              onClick={() => setShowExact(!showExact)}
              className="text-xs text-primary"
            >
              {showExact ? "Use time of day" : "Use exact time"}
            </button>
          </div>
          {showExact ? (
            <Input
              type="time"
              value={exactTime}
              onChange={(e) => setExactTime(e.target.value)}
            />
          ) : (
            <Select value={timeOfDay || "none"} onValueChange={(v) => setTimeOfDay(v && v !== "none" ? v : "")}>
              <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any time</SelectItem>
                <SelectItem value="morning">Morning (12 AM–12 PM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12 PM–4 PM)</SelectItem>
                <SelectItem value="evening">Evening (4 PM–8 PM)</SelectItem>
                <SelectItem value="night">Night (8 PM–12 AM)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Default duration — hidden for progress habits (time is tracked via units/conversion) */}
        {!progressOn && (
          <div className="space-y-2">
            <Label>Default duration (min) <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-2">
            <Label>Group</Label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {groupId ? (groups.find((g) => g.id === groupId)?.name ?? groupId) : "None"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="w-full text-sm text-destructive hover:text-destructive/80 transition-colors py-2"
        >
          {isPending ? "Deleting…" : confirmDelete ? "Tap again to confirm delete" : "Delete habit"}
        </button>
      </form>
    </>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto px-6 pb-6">
          <DialogHeader className="mb-5">
            <DialogTitle>Edit Habit</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-5" showHandle>
          <SheetTitle>Edit Habit</SheetTitle>
        </SheetHeader>
        {formContent}
      </SheetContent>
    </Sheet>
  );
}
