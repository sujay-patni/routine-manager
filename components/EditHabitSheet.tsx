"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateHabit, deleteHabit } from "@/app/actions/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { OptimisticAction } from "@/app/today/TodayClient";

interface EditHabitSheetProps {
  habit: ProcessedHabit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchHabit?: (action: OptimisticAction<ProcessedHabit>) => void;
}

export default function EditHabitSheet({ habit, open, onOpenChange, dispatchHabit }: EditHabitSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress fields
  const [progressOn, setProgressOn] = useState(!!habit?.progress_metric);
  const [metric, setMetric] = useState(habit?.progress_metric ?? "");
  const [target, setTarget] = useState(String(habit?.progress_target ?? ""));
  const [start, setStart] = useState(String(habit?.progress_start ?? 0));

  // Timing fields
  const [showExact, setShowExact] = useState(!!habit?.exact_time);
  const [timeOfDay, setTimeOfDay] = useState(habit?.time_of_day ?? "");
  const [exactTime, setExactTime] = useState(habit?.exact_time ?? "");

  // Sync state when habit prop changes (sheet reopens with different habit)
  function resetToHabit(h: ProcessedHabit | null) {
    setProgressOn(!!h?.progress_metric);
    setMetric(h?.progress_metric ?? "");
    setTarget(String(h?.progress_target ?? ""));
    setStart(String(h?.progress_start ?? 0));
    setShowExact(!!h?.exact_time);
    setTimeOfDay(h?.time_of_day ?? "");
    setExactTime(h?.exact_time ?? "");
    setError(null);
    setConfirmDelete(false);
  }

  const [prevHabit, setPrevHabit] = useState(habit);
  if (habit !== prevHabit) {
    setPrevHabit(habit);
    if (habit) resetToHabit(habit);
  }

  function handleDelete() {
    if (!habit) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    
    startTransition(async () => {
      if (dispatchHabit) dispatchHabit({ action: "delete", item: habit });
      const result = await deleteHabit(habit.id);
      if (result.error) console.error("Error deleting habit:", result.error);
      else router.refresh();
    });
    
    onOpenChange(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!habit) return;
    setError(null);
    const payload = {
      progress_metric: progressOn ? metric || null : null,
      progress_target: progressOn && target ? Number(target) : null,
      progress_start: progressOn ? Number(start) : null,
      time_of_day: showExact ? null : (timeOfDay as ProcessedHabit["time_of_day"]) || null,
      exact_time: showExact ? exactTime || null : null,
    };
    
    startTransition(async () => {
      if (dispatchHabit) {
        dispatchHabit({ action: "update", item: { ...habit, ...payload } as ProcessedHabit });
      }
      const result = await updateHabit(habit.id, payload);
      if (result.error) console.error("Error updating habit:", result.error);
      else router.refresh();
    });
    
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) resetToHabit(habit);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 md:px-8 pb-10">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            <span>{habit?.icon}</span>
            <span>{habit?.name}</span>
          </SheetTitle>
        </SheetHeader>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <form onSubmit={handleSave} className="space-y-5">

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
              <Select value={timeOfDay} onValueChange={(v) => setTimeOfDay(v ?? "")}>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input type="number" min={0} value={start} onChange={(e) => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 0) val = 0;
                    setStart(String(val));
                  }} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target</Label>
                  <Input type="number" min={1} value={target} onChange={(e) => {
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 1) val = 1;
                    setTarget(String(val));
                  }} placeholder="10000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="steps" />
                </div>
              </div>
            )}
            {progressOn && (
              <p className="text-xs text-muted-foreground">
                On your Today view, tap the habit card to log progress. The habit is marked done when you reach the target.
              </p>
            )}
          </div>

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
      </SheetContent>
    </Sheet>
  );
}
