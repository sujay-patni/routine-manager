"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateEvent, deleteEvent, type TodayEvent } from "@/app/actions/events";
import type { AppEvent } from "@/lib/notion/types";
import type { OptimisticAction } from "@/app/today/TodayClient";

interface EditEventSheetProps {
  event: AppEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchEvent?: (action: OptimisticAction<TodayEvent>) => void;
}

const SURFACE_OPTIONS = [
  { value: "1",  label: "1 day before" },
  { value: "2",  label: "2 days before" },
  { value: "3",  label: "3 days before" },
  { value: "5",  label: "5 days before" },
  { value: "7",  label: "1 week before" },
  { value: "14", label: "2 weeks before" },
  { value: "30", label: "1 month before" },
];

function isoDatePart(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr.split("T")[0];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoTimePart(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    const t = isoStr.split("T")[1];
    return t ? t.slice(0, 5) : "";
  }
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EditEventSheet({ event, open, onOpenChange, dispatchEvent }: EditEventSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteMode, setDeleteMode] = useState<"none" | "confirm_single" | "prompt_recurring">("none");
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Shared fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(event?.duration_minutes != null ? String(event.duration_minutes) : "");

  // Timed-specific
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // All-day-specific
  const [taskDate, setTaskDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [dueTime, setDueTime] = useState("");

  // Deadline-specific
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [surfaceDays, setSurfaceDays] = useState("3");

  function resetToEvent(e: AppEvent | null) {
    if (!e) return;
    setTitle(e.title);
    setDescription(e.description ?? "");
    setDuration(e.duration_minutes != null ? String(e.duration_minutes) : "");
    setError(null);
    setDeleteMode("none");

    if (e.event_type === "timed") {
      setEventDate(isoDatePart(e.start_time));
      setStartTime(isoTimePart(e.start_time));
      setEndTime(isoTimePart(e.end_time));
    } else if (e.event_type === "all_day") {
      setTaskDate(e.due_date ?? "");
      setTimeOfDay(e.time_of_day ?? "");
      setDueTime(e.due_time ?? "");
    } else if (e.event_type === "deadline") {
      setDeadlineDate(e.due_date ?? "");
      setDeadlineTime(e.due_time ?? "");
      setSurfaceDays(String(e.surface_days ?? 3));
    }
  }

  const [prevEvent, setPrevEvent] = useState(event);
  if (event !== prevEvent) {
    setPrevEvent(event);
    if (event) resetToEvent(event);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError(null);

    const data: Parameters<typeof updateEvent>[1] = {
      title,
      description: description || undefined,
      duration_minutes: duration ? Number(duration) : null,
    };

    if (event.event_type === "timed") {
      const dateStr = eventDate || isoDatePart(event.start_time);
      data.start_time = startTime ? new Date(`${dateStr}T${startTime}:00`).toISOString() : null;
      data.end_time = endTime ? new Date(`${dateStr}T${endTime}:00`).toISOString() : null;
    } else if (event.event_type === "all_day") {
      data.due_date = taskDate || null;
      data.time_of_day = timeOfDay || null;
      data.due_time = dueTime || null;
    } else if (event.event_type === "deadline") {
      data.due_date = deadlineDate || null;
      data.due_time = deadlineTime || null;
      data.surface_days = Number(surfaceDays);
    }

    if (event.id.startsWith("temp-")) return;

    startTransition(async () => {
      if (dispatchEvent) {
        dispatchEvent({ action: "update", item: { ...event, ...data, id: event.id } as TodayEvent });
      }
      const result = await updateEvent(event.id, data);
      if (result.error) console.error("Error updating event:", result.error);
      else router.refresh();
    });

    onOpenChange(false);
  }

  function handleDeletePrompt() {
    if (!event) return;
    if (event.is_recurring && event.id.includes("_")) {
      if (deleteMode === "prompt_recurring") setDeleteMode("none"); // toggle
      else setDeleteMode("prompt_recurring");
    } else {
      if (deleteMode === "confirm_single") executeDelete("all");
      else setDeleteMode("confirm_single");
    }
  }

  function executeDelete(scope: "all" | "this") {
    if (!event) return;

    startTransition(async () => {
      if (dispatchEvent) {
        dispatchEvent({ action: "delete", item: event as TodayEvent });
      }
      let excludeDateString = undefined;
      if (scope === "this" && event.id.includes("_")) {
        excludeDateString = event.id.split("_")[1];
      }
      const result = await deleteEvent(event.id, excludeDateString);
      if (result.error) console.error("Error deleting event:", result.error);
      else router.refresh();
    });

    setDeleteMode("none");
    onOpenChange(false);
  }

  const typeLabel = event?.event_type === "timed" ? "Event"
    : event?.event_type === "all_day" ? "Task"
    : "Deadline";

  const typeIcon = event?.event_type === "timed" ? "📅"
    : event?.event_type === "all_day" ? "📋"
    : "⏰";

  const handleOpenChange = (o: boolean) => { if (!o) resetToEvent(event); onOpenChange(o); };

  const formContent = (
    <>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <form onSubmit={handleSave} className="space-y-5">

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details…"
              rows={2}
            />
          </div>

          {/* Timed event fields */}
          {event?.event_type === "timed" && (
            <>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* All-day task fields */}
          {event?.event_type === "all_day" && (
            <>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  placeholder="Or exact time"
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* Deadline fields */}
          {event?.event_type === "deadline" && (
            <>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Remind me</Label>
                <Select value={surfaceDays} onValueChange={(v) => v && setSurfaceDays(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SURFACE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label>Default duration (min) <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>

          {deleteMode === "prompt_recurring" ? (
            <div className="flex flex-col gap-2 mt-4 fade-in">
              <Button type="button" variant="destructive" onClick={() => executeDelete("this")}>
                Delete just this occurrence
              </Button>
              <Button type="button" variant="outline" className="text-destructive border-destructive" onClick={() => executeDelete("all")}>
                Delete series
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeletePrompt}
              disabled={isPending}
              className="w-full text-sm text-destructive hover:text-destructive/80 transition-colors py-2 mt-2"
            >
              {deleteMode === "confirm_single" ? "Tap again to confirm delete" : `Delete ${typeLabel.toLowerCase()}`}
            </button>
          )}
        </form>
    </>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto px-6 pb-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="flex items-center gap-2">
              <span>{typeIcon}</span>
              <span>Edit {typeLabel}</span>
            </DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-5" showHandle>
          <SheetTitle className="flex items-center gap-2">
            <span>{typeIcon}</span>
            <span>Edit {typeLabel}</span>
          </SheetTitle>
        </SheetHeader>
        {formContent}
      </SheetContent>
    </Sheet>
  );
}
