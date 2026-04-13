"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createHabit } from "@/app/actions/habits";
import { createEvent } from "@/app/actions/events";
import type { HabitFrequency } from "@/lib/notion/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

const ICONS = ["✨", "💪", "🏃", "📚", "🧘", "💻", "🎯", "🌱", "🎵", "✍️", "🥗", "💤", "🚴", "🏋️", "🧠"];

const DAYS_OF_WEEK = [
  { abbr: "MO", label: "Mon" },
  { abbr: "TU", label: "Tue" },
  { abbr: "WE", label: "Wed" },
  { abbr: "TH", label: "Thu" },
  { abbr: "FR", label: "Fri" },
  { abbr: "SA", label: "Sat" },
  { abbr: "SU", label: "Sun" },
];

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "habit" | "timed" | "all_day" | "deadline";
}

export default function AddItemSheet({ open, onOpenChange, defaultTab = "habit" }: AddItemSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // — Habit state —
  const [habitName, setHabitName] = useState("");
  const [habitDesc, setHabitDesc] = useState("");
  const [habitFreq, setHabitFreq] = useState<HabitFrequency>("daily");
  const [habitTarget, setHabitTarget] = useState(3);
  const [habitColor, setHabitColor] = useState(COLORS[0]);
  const [habitIcon, setHabitIcon] = useState(ICONS[0]);
  const [habitTimeOfDay, setHabitTimeOfDay] = useState("");
  const [habitExactTime, setHabitExactTime] = useState("");
  const [habitShowExact, setHabitShowExact] = useState(false);
  const [habitDays, setHabitDays] = useState<string[]>([]);       // specific_days_weekly
  const [habitDates, setHabitDates] = useState<string[]>([]);     // specific_dates_monthly
  const [habitYearlyMonth, setHabitYearlyMonth] = useState("01");
  const [habitYearlyDate, setHabitYearlyDate] = useState("01");
  const [habitProgressOn, setHabitProgressOn] = useState(false);
  const [habitMetric, setHabitMetric] = useState("");
  const [habitTarget2, setHabitTarget2] = useState("");
  const [habitStart, setHabitStart] = useState("0");

  // — Event/Task/Deadline state —
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(todayISO());
  const [eventTime, setEventTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [dueTime, setDueTime] = useState("");
  const [surfaceDays, setSurfaceDays] = useState(3);
  const [recurrence, setRecurrence] = useState("none");
  const [eventTimeOfDay, setEventTimeOfDay] = useState("");
  const [eventShowExact, setEventShowExact] = useState(false);
  const [eventProgressOn, setEventProgressOn] = useState(false);
  const [eventMetric, setEventMetric] = useState("");
  const [eventTarget, setEventTarget] = useState("");

  function todayISO() {
    return new Date().toISOString().split("T")[0];
  }

  function resetForms() {
    setHabitName(""); setHabitDesc(""); setHabitFreq("daily"); setHabitTarget(3);
    setHabitColor(COLORS[0]); setHabitIcon(ICONS[0]);
    setHabitTimeOfDay(""); setHabitExactTime(""); setHabitShowExact(false);
    setHabitDays([]); setHabitDates([]);
    setHabitYearlyMonth("01"); setHabitYearlyDate("01");
    setHabitProgressOn(false); setHabitMetric(""); setHabitTarget2(""); setHabitStart("0");
    setEventTitle(""); setEventDesc(""); setEventDate(todayISO()); setEventTime("09:00");
    setEventEndTime(""); setDueDate(todayISO()); setDueTime("");
    setSurfaceDays(3); setRecurrence("none");
    setEventTimeOfDay(""); setEventShowExact(false);
    setEventProgressOn(false); setEventMetric(""); setEventTarget("");
    setError(null);
  }

  function buildRRule(r: string): string | undefined {
    if (r === "none") return undefined;
    if (r === "daily") return "FREQ=DAILY";
    if (r === "weekly") return "FREQ=WEEKLY";
    if (r === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    if (r === "monthly") return "FREQ=MONTHLY";
    if (r === "yearly") return "FREQ=YEARLY";
    return undefined;
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

  function getHabitSpecificDays(): string | undefined {
    if (habitFreq === "specific_days_weekly" && habitDays.length > 0) {
      return habitDays.join(",");
    }
    if (habitFreq === "specific_dates_monthly" && habitDates.length > 0) {
      return habitDates.join(",");
    }
    if (habitFreq === "specific_dates_yearly") {
      return `${habitYearlyMonth}-${habitYearlyDate.padStart(2, "0")}`;
    }
    return undefined;
  }

  async function handleHabitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!habitName.trim()) return;
    setLoading(true); setError(null);
    const result = await createHabit({
      name: habitName.trim(),
      description: habitDesc || undefined,
      frequency: habitFreq,
      weekly_target: habitFreq === "weekly" ? habitTarget : undefined,
      color: habitColor,
      icon: habitIcon,
      time_of_day: habitShowExact ? undefined : habitTimeOfDay || undefined,
      exact_time: habitShowExact ? habitExactTime || undefined : undefined,
      specific_days: getHabitSpecificDays(),
      progress_metric: habitProgressOn ? habitMetric || undefined : undefined,
      progress_target: habitProgressOn && habitTarget2 ? Number(habitTarget2) : undefined,
      progress_start: habitProgressOn ? Number(habitStart) : undefined,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms(); onOpenChange(false); router.refresh();
  }

  async function handleTimedEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setLoading(true); setError(null);
    const startISO = `${eventDate}T${eventTime}:00`;
    const endISO = eventEndTime ? `${eventDate}T${eventEndTime}:00` : undefined;
    const rrule = buildRRule(recurrence);
    const result = await createEvent({
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "timed",
      start_time: startISO,
      end_time: endISO,
      is_recurring: recurrence !== "none",
      recurrence_rule: rrule,
      progress_metric: eventProgressOn ? eventMetric || undefined : undefined,
      progress_target: eventProgressOn && eventTarget ? Number(eventTarget) : undefined,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms(); onOpenChange(false); router.refresh();
  }

  async function handleAllDaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setLoading(true); setError(null);
    const result = await createEvent({
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "all_day",
      due_date: dueDate,
      time_of_day: !eventShowExact ? eventTimeOfDay || undefined : undefined,
      due_time: eventShowExact ? dueTime || undefined : undefined,
      is_recurring: recurrence !== "none",
      recurrence_rule: buildRRule(recurrence),
      progress_metric: eventProgressOn ? eventMetric || undefined : undefined,
      progress_target: eventProgressOn && eventTarget ? Number(eventTarget) : undefined,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms(); onOpenChange(false); router.refresh();
  }

  async function handleDeadlineSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setLoading(true); setError(null);
    const result = await createEvent({
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "deadline",
      due_date: dueDate,
      due_time: dueTime || undefined,
      surface_days: surfaceDays,
      is_recurring: recurrence !== "none",
      recurrence_rule: buildRRule(recurrence),
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms(); onOpenChange(false); router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) resetForms(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-4">
          <SheetTitle>Add to your routine</SheetTitle>
        </SheetHeader>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <Tabs defaultValue={defaultTab}>
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

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={habitFreq} onValueChange={v => v && setHabitFreq(v as HabitFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly (with target)</SelectItem>
                    <SelectItem value="specific_days_weekly">Specific days (weekly)</SelectItem>
                    <SelectItem value="specific_dates_monthly">Specific dates (monthly)</SelectItem>
                    <SelectItem value="specific_dates_yearly">Specific date (yearly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {habitFreq === "weekly" && (
                <div className="space-y-2">
                  <Label>Weekly target (days)</Label>
                  <Input type="number" min={1} max={7} value={habitTarget} onChange={e => setHabitTarget(Number(e.target.value))} />
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={habitYearlyMonth} onValueChange={(v) => v != null && setHabitYearlyMonth(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Input type="number" min={1} max={31} value={habitYearlyDate} onChange={e => setHabitYearlyDate(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Timing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Timing <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                      <SelectItem value="morning">Morning (6am–12pm)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12pm–5pm)</SelectItem>
                      <SelectItem value="evening">Evening (5pm–9pm)</SelectItem>
                      <SelectItem value="night">Night (9pm+)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Icon + Color */}
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setHabitIcon(ic)}
                      className={`text-xl p-1.5 rounded-xl border-2 transition-all ${habitIcon === ic ? "border-primary bg-accent" : "border-transparent"}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setHabitColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full border-4 transition-all ${habitColor === c ? "border-foreground scale-110" : "border-transparent"}`} />
                  ))}
                </div>
              </div>

              {/* Progress tracking toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Progress tracking <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <button type="button" onClick={() => setHabitProgressOn(!habitProgressOn)} className="text-xs text-primary">
                    {habitProgressOn ? "Remove" : "Add"}
                  </button>
                </div>
                {habitProgressOn && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Start</Label>
                      <Input type="number" value={habitStart} onChange={e => setHabitStart(e.target.value)} placeholder="0" />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Target</Label>
                      <Input type="number" value={habitTarget2} onChange={e => setHabitTarget2(e.target.value)} placeholder="10000" />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={habitMetric} onChange={e => setHabitMetric(e.target.value)} placeholder="steps" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea placeholder="Any notes…" value={habitDesc} onChange={e => setHabitDesc(e.target.value)} rows={2} />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Habit"}
              </Button>
            </form>
          </TabsContent>

          {/* ─── TIMED EVENT ─── */}
          <TabsContent value="timed">
            <form onSubmit={handleTimedEventSubmit} className="space-y-4">
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
                <Label>End time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="time" value={eventEndTime} onChange={e => setEventEndTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Repeat</Label>
                <Select value={recurrence} onValueChange={v => v && setRecurrence(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="weekdays">Weekdays only</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Progress tracking <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <button type="button" onClick={() => setEventProgressOn(!eventProgressOn)} className="text-xs text-primary">
                    {eventProgressOn ? "Remove" : "Add"}
                  </button>
                </div>
                {eventProgressOn && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Target</Label>
                      <Input type="number" value={eventTarget} onChange={e => setEventTarget(e.target.value)} placeholder="e.g. 5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={eventMetric} onChange={e => setEventMetric(e.target.value)} placeholder="e.g. km" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Event"}
              </Button>
            </form>
          </TabsContent>

          {/* ─── TASK (all_day) ─── */}
          <TabsContent value="all_day">
            <form onSubmit={handleAllDaySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Task</Label>
                <Input placeholder="e.g. Submit report" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
              </div>

              {/* Timing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Timing <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                      <SelectItem value="morning">Morning (6am–12pm)</SelectItem>
                      <SelectItem value="afternoon">Afternoon (12pm–5pm)</SelectItem>
                      <SelectItem value="evening">Evening (5pm–9pm)</SelectItem>
                      <SelectItem value="night">Night (9pm+)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Repeat</Label>
                <Select value={recurrence} onValueChange={v => v && setRecurrence(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="weekdays">Weekdays only</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Progress tracking <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <button type="button" onClick={() => setEventProgressOn(!eventProgressOn)} className="text-xs text-primary">
                    {eventProgressOn ? "Remove" : "Add"}
                  </button>
                </div>
                {eventProgressOn && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Target</Label>
                      <Input type="number" value={eventTarget} onChange={e => setEventTarget(e.target.value)} placeholder="e.g. 10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input value={eventMetric} onChange={e => setEventMetric(e.target.value)} placeholder="e.g. pages" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Task"}
              </Button>
            </form>
          </TabsContent>

          {/* ─── DEADLINE ─── */}
          <TabsContent value="deadline">
            <form onSubmit={handleDeadlineSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>What&apos;s the deadline?</Label>
                <Input placeholder="e.g. File taxes" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Due time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Start reminding me</Label>
                <Select value={String(surfaceDays)} onValueChange={v => v && setSurfaceDays(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Deadline"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
