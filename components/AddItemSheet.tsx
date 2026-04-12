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

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

const ICONS = ["✨", "💪", "🏃", "📚", "🧘", "💻", "🎯", "🌱", "🎵", "✍️", "🥗", "💤", "🚴", "🏋️", "🧠"];

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "habit" | "timed" | "all_day" | "deadline";
}

export default function AddItemSheet({ open, onOpenChange, defaultTab = "habit" }: AddItemSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Habit form state
  const [habitName, setHabitName] = useState("");
  const [habitDesc, setHabitDesc] = useState("");
  const [habitFreq, setHabitFreq] = useState<"daily" | "weekly">("daily");
  const [habitTarget, setHabitTarget] = useState(3);
  const [habitColor, setHabitColor] = useState(COLORS[0]);
  const [habitIcon, setHabitIcon] = useState(ICONS[0]);

  // Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventTime, setEventTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [surfaceDays, setSurfaceDays] = useState(3);
  const [recurrence, setRecurrence] = useState("none");

  function resetForms() {
    setHabitName(""); setHabitDesc(""); setHabitFreq("daily"); setHabitTarget(3);
    setHabitColor(COLORS[0]); setHabitIcon(ICONS[0]);
    setEventTitle(""); setEventDesc(""); setEventTime("09:00"); setEventEndTime("");
    setRecurrence("none"); setError(null);
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
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms();
    onOpenChange(false);
    router.refresh();
  }

  async function handleTimedEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setLoading(true); setError(null);
    const startISO = `${eventDate}T${eventTime}:00`;
    const endISO = eventEndTime ? `${eventDate}T${eventEndTime}:00` : undefined;
    let rrule: string | undefined;
    if (recurrence === "daily") rrule = "FREQ=DAILY";
    else if (recurrence === "weekly") rrule = `FREQ=WEEKLY`;
    else if (recurrence === "weekdays") rrule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    const result = await createEvent({
      title: eventTitle.trim(),
      description: eventDesc || undefined,
      event_type: "timed",
      start_time: startISO,
      end_time: endISO,
      is_recurring: recurrence !== "none",
      recurrence_rule: rrule,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms();
    onOpenChange(false);
    router.refresh();
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
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms();
    onOpenChange(false);
    router.refresh();
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
      surface_days: surfaceDays,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    resetForms();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) resetForms(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle>Add to your routine</SheetTitle>
        </SheetHeader>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full mb-4 h-auto">
            <TabsTrigger value="habit" className="flex-1 text-xs py-2">Habit</TabsTrigger>
            <TabsTrigger value="timed" className="flex-1 text-xs py-2">Event</TabsTrigger>
            <TabsTrigger value="all_day" className="flex-1 text-xs py-2">Task</TabsTrigger>
            <TabsTrigger value="deadline" className="flex-1 text-xs py-2">Deadline</TabsTrigger>
          </TabsList>

          {/* HABIT */}
          <TabsContent value="habit">
            <form onSubmit={handleHabitSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g. Morning run" value={habitName} onChange={e => setHabitName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={habitFreq} onValueChange={v => v && setHabitFreq(v as "daily" | "weekly")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Weekly (with target)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {habitFreq === "weekly" && (
                <div className="space-y-2">
                  <Label>Weekly target (days)</Label>
                  <Input type="number" min={1} max={7} value={habitTarget} onChange={e => setHabitTarget(Number(e.target.value))} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setHabitIcon(ic)}
                      className={`text-xl p-1.5 rounded-lg border-2 transition-all ${habitIcon === ic ? "border-primary" : "border-transparent"}`}>
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
                      className={`w-8 h-8 rounded-full border-4 transition-all ${habitColor === c ? "border-foreground" : "border-transparent"}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea placeholder="Any notes…" value={habitDesc} onChange={e => setHabitDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Habit"}
              </Button>
            </form>
          </TabsContent>

          {/* TIMED EVENT */}
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
                <Label>End time (optional)</Label>
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Event"}
              </Button>
            </form>
          </TabsContent>

          {/* ALL DAY TASK */}
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
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any details…" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding…" : "Add Task"}
              </Button>
            </form>
          </TabsContent>

          {/* DEADLINE */}
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
                <Label>Remind me this many days before</Label>
                <Select value={String(surfaceDays)} onValueChange={v => v && setSurfaceDays(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day before</SelectItem>
                    <SelectItem value="2">2 days before</SelectItem>
                    <SelectItem value="3">3 days before</SelectItem>
                    <SelectItem value="5">5 days before</SelectItem>
                    <SelectItem value="7">1 week before</SelectItem>
                    <SelectItem value="14">2 weeks before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
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
