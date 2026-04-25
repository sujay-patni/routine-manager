"use client";

import { useState, useTransition, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createHabit } from "@/app/actions/habits";
import { createEvent } from "@/app/actions/events";
import type { HabitFrequency, Group } from "@/lib/notion/types";
import { cn } from "@/lib/utils";
import type { OptimisticAction } from "@/app/today/TodayClient";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { TodayEvent } from "@/app/actions/events";

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

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly (with target)",
  specific_days_weekly: "Specific days (weekly)",
  specific_dates_monthly: "Specific dates (monthly)",
  specific_dates_yearly: "Specific date (yearly)",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "No repeat",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays only",
  specific_days: "Specific days (weekly)",
  monthly: "Monthly",
  yearly: "Yearly",
};

const SURFACE_LABELS: Record<string, string> = {
  "1": "1 day before",
  "2": "2 days before",
  "3": "3 days before",
  "5": "5 days before",
  "7": "1 week before",
  "14": "2 weeks before",
  "30": "1 month before",
};

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "habit" | "timed" | "all_day" | "deadline";
  defaultDate?: string; // YYYY-MM-DD — pre-fills date fields
  dispatchHabit?: (action: OptimisticAction<ProcessedHabit>) => void;
  dispatchEvent?: (action: OptimisticAction<TodayEvent>) => void;
  groups?: Group[];
}

// toISOString() is always UTC — use Intl.DateTimeFormat to get the
// browser-local date so users east of UTC don't get yesterday's date.
function todayISO() {
  return new Intl.DateTimeFormat("en-CA").format(new Date()); // "en-CA" gives YYYY-MM-DD
}

export default function AddItemSheet({ open, onOpenChange, defaultTab = "habit", defaultDate, dispatchHabit, dispatchEvent, groups = [] }: AddItemSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // — Habit state —
  const [habitName, setHabitName] = useState("");
  const [habitDesc, setHabitDesc] = useState("");
  const [habitFreq, setHabitFreq] = useState<HabitFrequency>("daily");
  const [habitTarget, setHabitTarget] = useState(3);
  const [habitTimeOfDay, setHabitTimeOfDay] = useState("");
  const [habitExactTime, setHabitExactTime] = useState("");
  const [habitShowExact, setHabitShowExact] = useState(false);
  const [habitDays, setHabitDays] = useState<string[]>([]);
  const [habitDates, setHabitDates] = useState<string[]>([]);
  // yearly: multiple MM-DD entries
  const [habitYearlyDates, setHabitYearlyDates] = useState<Array<{ month: string; day: string }>>([
    { month: "01", day: "01" },
  ]);
  const [habitProgressOn, setHabitProgressOn] = useState(false);
  const [habitMetric, setHabitMetric] = useState("");
  const [habitTarget2, setHabitTarget2] = useState("");
  const [habitStart, setHabitStart] = useState("0");
  const [habitProgressPeriod, setHabitProgressPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");

  // — Event/Task/Deadline state —
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(todayISO);
  const [eventTime, setEventTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("");
  const [dueDate, setDueDate] = useState(todayISO);
  const [dueTime, setDueTime] = useState("");
  const [surfaceDays, setSurfaceDays] = useState(3);
  const [recurrence, setRecurrence] = useState("none");
  const [eventDays, setEventDays] = useState<string[]>([]);
  const [eventTimeOfDay, setEventTimeOfDay] = useState("");
  const [eventShowExact, setEventShowExact] = useState(false);
  const [groupId, setGroupId] = useState("");

  function baseDate() {
    return defaultDate ?? todayISO();
  }

  const [prevDefaultDate, setPrevDefaultDate] = useState(defaultDate);
  if (defaultDate !== prevDefaultDate) {
    setPrevDefaultDate(defaultDate);
    if (defaultDate) {
      setEventDate(defaultDate);
      setDueDate(defaultDate);
    }
  }

  function resetForms() {
    setHabitName(""); setHabitDesc(""); setHabitFreq("daily"); setHabitTarget(3);
    setHabitTimeOfDay(""); setHabitExactTime(""); setHabitShowExact(false);
    setHabitDays([]); setHabitDates([]);
    setHabitYearlyDates([{ month: "01", day: "01" }]);
    setHabitProgressOn(false); setHabitMetric(""); setHabitTarget2(""); setHabitStart("0");
    setHabitProgressPeriod("daily");
    setEventTitle(""); setEventDesc(""); setEventDate(baseDate()); setEventTime("09:00");
    setEventEndTime(""); setDueDate(baseDate()); setDueTime("");
    setSurfaceDays(3); setRecurrence("none"); setEventDays([]);
    setEventTimeOfDay(""); setEventShowExact(false);
    setGroupId("");
    setError(null);
    setWarning(null);
  }

  function buildRRule(r: string, days?: string[]): string | undefined {
    if (r === "none") return undefined;
    if (r === "daily") return "FREQ=DAILY";
    if (r === "weekly") return "FREQ=WEEKLY";
    if (r === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    if (r === "specific_days") {
      const byday = (days ?? []).join(",");
      return byday ? `FREQ=WEEKLY;BYDAY=${byday}` : "FREQ=WEEKLY";
    }
    if (r === "monthly") return "FREQ=MONTHLY";
    if (r === "yearly") return "FREQ=YEARLY";
    return undefined;
  }

  function toggleEventDay(abbr: string) {
    setEventDays(prev => prev.includes(abbr) ? prev.filter(d => d !== abbr) : [...prev, abbr]);
  }

  function toggleDay(abbr: string) {
    setHabitDays((prev) =>
      prev.includes(abbr) ? prev.filter((d) => d !== abbr) : [...prev, abbr]
    );
  }

  function toggleDate(d: string) {
    setHabitDates((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function addYearlyDate() {
    setHabitYearlyDates((prev) => [...prev, { month: "01", day: "01" }]);
  }

  function removeYearlyDate(idx: number) {
    setHabitYearlyDates((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateYearlyDate(idx: number, field: "month" | "day", value: string) {
    setHabitYearlyDates((prev) =>
      prev.map((entry, i) => (i === idx ? { ...entry, [field]: value } : entry))
    );
  }

  function getHabitSpecificDays(): string | undefined {
    if (habitFreq === "specific_days_weekly" && habitDays.length > 0) {
      return habitDays.join(",");
    }
    if (habitFreq === "specific_dates_monthly" && habitDates.length > 0) {
      return habitDates.join(",");
    }
    if (habitFreq === "specific_dates_yearly" && habitYearlyDates.length > 0) {
      return habitYearlyDates
        .map(({ month, day }) => `${month}-${String(day).padStart(2, "0")}`)
        .join(",");
    }
    return undefined;
  }

  function handleHabitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!habitName.trim()) return;
    setError(null);
    const payload = {
      name: habitName.trim(),
      description: habitDesc || undefined,
      frequency: habitFreq,
      weekly_target: habitFreq === "weekly" && !habitProgressOn ? habitTarget : undefined,
      time_of_day: habitShowExact ? undefined : habitTimeOfDay || undefined,
      exact_time: habitShowExact ? habitExactTime || undefined : undefined,
      specific_days: getHabitSpecificDays(),
      progress_metric: habitProgressOn ? habitMetric || undefined : undefined,
      progress_target: habitProgressOn && habitTarget2 ? Number(habitTarget2) : undefined,
      progress_start: habitProgressOn ? Number(habitStart) : undefined,
      progress_period: habitProgressOn ? habitProgressPeriod : undefined,
      group_id: groupId || null,
    };

    startTransition(async () => {
      if (dispatchHabit) {
        dispatchHabit({
          action: "add",
          item: {
            ...payload,
            id: "temp-habit-" + Date.now(),
            created_at: new Date().toISOString(),
            color: "#6366f1",
            icon: "",
            is_active: true,
            completed_today: 0,
            completions_this_week: 0,
            today_progress: null,
            today_contribution: null,
            week_progress: null,
            today_completion_id: null,
            sort_order: null,
            group_id: groupId || null,
            target: payload.frequency === "daily" ? 7 : (payload.weekly_target || 1),
            remaining: payload.frequency === "daily" ? 7 : (payload.weekly_target || 1),
            daysLeftInWeek: 7,
            state: "pending",
            show: true
          } as ProcessedHabit
        });
      }
      const result = await createHabit(payload);
      if (result.error) console.error("Error creating habit:", result.error);
    });

    resetForms();
    onOpenChange(false);
  }

  function handleTimedEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setError(null);
    const startISO = new Date(`${eventDate}T${eventTime}:00`).toISOString();
    const endISO = eventEndTime ? new Date(`${eventDate}T${eventEndTime}:00`).toISOString() : undefined;
    const rrule = buildRRule(recurrence, eventDays);
    const payload = {
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "timed" as const,
      start_time: startISO,
      end_time: endISO,
      is_recurring: recurrence !== "none",
      recurrence_rule: rrule,
      group_id: groupId || null,
    };

    startTransition(async () => {
      if (dispatchEvent) {
        dispatchEvent({
          action: "add",
          item: { ...payload, id: "temp-event-" + Date.now(), is_completed: false } as TodayEvent
        });
      }
      const result = await createEvent(payload);
      if (result.error) console.error("Error creating bounded event:", result.error);
    });

    resetForms();
    onOpenChange(false);
  }

  function handleAllDaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setError(null);
    const rrule = buildRRule(recurrence, eventDays);
    const payload = {
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "all_day" as const,
      due_date: dueDate,
      is_recurring: recurrence !== "none",
      recurrence_rule: rrule,
      group_id: groupId || null,
    };

    startTransition(async () => {
      if (dispatchEvent) {
        dispatchEvent({
          action: "add",
          item: { ...payload, id: "temp-event-" + Date.now(), is_completed: false } as TodayEvent
        });
      }
      const result = await createEvent(payload);
      if (result.error) console.error("Error creating all-day event:", result.error);
    });

    resetForms();
    onOpenChange(false);
  }

  function handleDeadlineSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setError(null);
    
    const payload = {
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "deadline" as const,
      due_date: dueDate,
      due_time: dueTime || undefined,
      surface_days: Number(surfaceDays),
      group_id: groupId || null,
    };

    startTransition(async () => {
      if (dispatchEvent) {
        dispatchEvent({
          action: "add",
          item: { ...payload, id: "temp-event-" + Date.now(), is_completed: false } as TodayEvent
        });
      }
      const result = await createEvent(payload);
      if (result.error) console.error("Error creating deadline:", result.error);
    });

    resetForms();
    onOpenChange(false);
  }

  const handleOpenChange = (o: boolean) => { if (!o) resetForms(); onOpenChange(o); };

  const innerContent = (
    <>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          {warning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 mb-3">
              <p className="font-semibold mb-1">Habit added ✓ — progress tracking skipped</p>
              <p>{warning}</p>
              <button onClick={() => { setWarning(null); onOpenChange(false); }} className="mt-2 text-xs font-medium underline">Dismiss</button>
            </div>
          )}

          <Tabs defaultValue={defaultTab} onValueChange={() => resetForms()}>
            <TabsList className="w-full mb-5 h-auto">
              <TabsTrigger value="habit" className="flex-1 text-xs py-2">Habit</TabsTrigger>
              <TabsTrigger value="timed" className="flex-1 text-xs py-2">Event</TabsTrigger>
              <TabsTrigger value="all_day" className="flex-1 text-xs py-2">Task</TabsTrigger>
              <TabsTrigger value="deadline" className="flex-1 text-xs py-2">Deadline</TabsTrigger>
            </TabsList>

            {/* ─── HABIT ─── */}
            <TabsContent value="habit">
              <form onSubmit={handleHabitSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Morning run" value={habitName} onChange={e => setHabitName(e.target.value)} required />
                </div>

                {/* Progress tracking — before frequency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Progress tracking</Label>
                    <button
                      type="button"
                      onClick={() => setHabitProgressOn(!habitProgressOn)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        habitProgressOn
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 hover:border-primary text-muted-foreground"
                      )}
                      aria-label={habitProgressOn ? "Remove progress tracking" : "Add progress tracking"}
                    >
                      {habitProgressOn ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {habitProgressOn && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1 space-y-1">
                          <Label className="text-xs">Start</Label>
                          <Input type="number" min={0} value={habitStart} onChange={e => {
                            let val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 0) val = 0;
                            setHabitStart(String(val));
                          }} placeholder="0" />
                        </div>
                        <div className="col-span-1 space-y-1">
                          <Label className="text-xs">Target</Label>
                          <Input type="number" min={1} value={habitTarget2} onChange={e => {
                            let val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 1) val = 1;
                            setHabitTarget2(String(val));
                          }} placeholder="10000" />
                        </div>
                        <div className="col-span-1 space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input value={habitMetric} onChange={e => setHabitMetric(e.target.value)} placeholder="steps" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Progress resets</Label>
                        <Select value={habitProgressPeriod} onValueChange={v => v && setHabitProgressPeriod(v as typeof habitProgressPeriod)}>
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
                  <Select value={habitFreq} onValueChange={v => v && setHabitFreq(v as HabitFrequency)}>
                    <SelectTrigger>
                      <SelectValue>{FREQ_LABELS[habitFreq]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      {!habitProgressOn && (
                        <SelectItem value="weekly">Weekly (with target)</SelectItem>
                      )}
                      <SelectItem value="specific_days_weekly">Specific days (weekly)</SelectItem>
                      <SelectItem value="specific_dates_monthly">Specific dates (monthly)</SelectItem>
                      <SelectItem value="specific_dates_yearly">Specific date (yearly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {habitFreq === "weekly" && !habitProgressOn && (
                  <div className="space-y-2">
                    <Label>Weekly target (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={habitTarget}
                      onChange={e => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > 7) val = 7;
                        setHabitTarget(val);
                      }}
                    />
                  </div>
                )}

                {habitFreq === "specific_days_weekly" && (
                  <div className="space-y-2">
                    <Label>Which days?</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS_OF_WEEK.map(({ abbr, label }) => (
                        <button
                          key={abbr} type="button"
                          onClick={() => toggleDay(abbr)}
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-all",
                            habitDays.includes(abbr)
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

                {habitFreq === "specific_dates_monthly" && (
                  <div className="space-y-2">
                    <Label>Which dates of the month?</Label>
                    <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                        <button
                          key={d} type="button"
                          onClick={() => toggleDate(d)}
                          className={cn(
                            "w-8 h-8 text-xs rounded-lg border font-medium transition-all",
                            habitDates.includes(d)
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

                {habitFreq === "specific_dates_yearly" && (
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
                      {habitYearlyDates.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Select value={entry.month} onValueChange={(v) => v && updateYearlyDate(idx, "month", v)}>
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
                          {habitYearlyDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeYearlyDate(idx)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Remove date"
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
                    <Label>Timing</Label>
                    <button
                      type="button"
                      onClick={() => setHabitShowExact(!habitShowExact)}
                      className="text-xs text-primary"
                    >
                      {habitShowExact ? "Use time of day" : "Use exact time"}
                    </button>
                  </div>
                  {habitShowExact ? (
                    <Input type="time" value={habitExactTime} onChange={e => setHabitExactTime(e.target.value)} />
                  ) : (
                    <Select value={habitTimeOfDay} onValueChange={(v) => setHabitTimeOfDay(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any time</SelectItem>
                        <SelectItem value="morning">Morning (12 AM–12 PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12 PM–4 PM)</SelectItem>
                        <SelectItem value="evening">Evening (4 PM–8 PM)</SelectItem>
                        <SelectItem value="night">Night (8 PM–12 AM)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Any notes…" value={habitDesc} onChange={e => setHabitDesc(e.target.value)} rows={2} />
                </div>

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
                  {isPending ? "Adding…" : "Add Habit"}
                </Button>
              </form>
            </TabsContent>

            {/* ─── TIMED EVENT ─── */}
            <TabsContent value="timed">
              <form onSubmit={handleTimedEventSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. Team standup" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Start time</Label>
                    <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Repeat</Label>
                  <Select value={recurrence} onValueChange={v => v && setRecurrence(v)}>
                    <SelectTrigger>
                      <SelectValue>{RECURRENCE_LABELS[recurrence] ?? recurrence}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="weekdays">Weekdays only</SelectItem>
                      <SelectItem value="specific_days">Specific days (weekly)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  {recurrence === "specific_days" && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(({ abbr, label }) => (
                        <button
                          key={abbr}
                          type="button"
                          onClick={() => toggleEventDay(abbr)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                            eventDays.includes(abbr)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
                </div>
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
                  {isPending ? "Adding…" : "Add Event"}
                </Button>
              </form>
            </TabsContent>

            {/* ─── TASK (all_day) ─── */}
            <TabsContent value="all_day">
              <form onSubmit={handleAllDaySubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>Task</Label>
                  <Input placeholder="e.g. Submit report" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Timing</Label>
                    <button type="button" onClick={() => setEventShowExact(!eventShowExact)} className="text-xs text-primary">
                      {eventShowExact ? "Use time of day" : "Use exact time"}
                    </button>
                  </div>
                  {eventShowExact ? (
                    <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
                  ) : (
                    <Select value={eventTimeOfDay} onValueChange={(v) => setEventTimeOfDay(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any time</SelectItem>
                        <SelectItem value="morning">Morning (12 AM–12 PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12 PM–4 PM)</SelectItem>
                        <SelectItem value="evening">Evening (4 PM–8 PM)</SelectItem>
                        <SelectItem value="night">Night (8 PM–12 AM)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Repeat</Label>
                  <Select value={recurrence} onValueChange={v => v && setRecurrence(v)}>
                    <SelectTrigger>
                      <SelectValue>{RECURRENCE_LABELS[recurrence] ?? recurrence}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="weekdays">Weekdays only</SelectItem>
                      <SelectItem value="specific_days">Specific days (weekly)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  {recurrence === "specific_days" && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(({ abbr, label }) => (
                        <button
                          key={abbr}
                          type="button"
                          onClick={() => toggleEventDay(abbr)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                            eventDays.includes(abbr)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
                </div>
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
                  {isPending ? "Adding…" : "Add Task"}
                </Button>
              </form>
            </TabsContent>

            {/* ─── DEADLINE ─── */}
            <TabsContent value="deadline">
              <form onSubmit={handleDeadlineSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>What&apos;s the deadline?</Label>
                  <Input placeholder="e.g. File taxes" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Due time</Label>
                  <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Start reminding me</Label>
                  <Select value={String(surfaceDays)} onValueChange={v => v && setSurfaceDays(Number(v))}>
                    <SelectTrigger>
                      <SelectValue>{SURFACE_LABELS[String(surfaceDays)] ?? `${surfaceDays} days before`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day before</SelectItem>
                      <SelectItem value="2">2 days before</SelectItem>
                      <SelectItem value="3">3 days before</SelectItem>
                      <SelectItem value="5">5 days before</SelectItem>
                      <SelectItem value="7">1 week before</SelectItem>
                      <SelectItem value="14">2 weeks before</SelectItem>
                      <SelectItem value="30">1 month before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Repeat</Label>
                  <Select value={recurrence} onValueChange={v => v && setRecurrence(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No repeat</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
                </div>
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
                  {isPending ? "Adding…" : "Add Deadline"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
    </>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto px-6 pb-6">
          <DialogHeader className="mb-4">
            <DialogTitle>Add to your routine</DialogTitle>
          </DialogHeader>
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-4" showHandle>
          <SheetTitle>Add to your routine</SheetTitle>
        </SheetHeader>
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
