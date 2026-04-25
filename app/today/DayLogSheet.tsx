"use client";

import { useState, useEffect, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDayLog } from "@/app/actions/habits";
import type { DayLogResult } from "@/app/actions/habits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function DayLogSheet({ open, onOpenChange, dateStr }: Props) {
  const [log, setLog] = useState<DayLogResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await getDayLog(dateStr);
      setLog(result);
    });
  }, [open, dateStr]);

  const content = (
    <div className="space-y-5 pt-1">
      {isPending && (
        <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
      )}

      {!isPending && log && (
        <>
          {/* Habit entries */}
          {log.habitEntries.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Habits</h3>
              <div className="space-y-1">
                {log.habitEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card">
                    <span className="text-sm">💪</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.habit_name}</p>
                      {entry.progress_value != null && entry.progress_metric && (
                        <p className="text-xs text-muted-foreground">
                          {entry.progress_value} {entry.progress_metric}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {entry.duration_actual != null
                        ? formatMinutes(entry.duration_actual)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {log.habitEntries.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground text-center py-4">No habits completed on this day.</p>
          )}

          {/* Summary footer */}
          {log.totalTrackedMinutes > 0 && (
            <div className="rounded-xl border bg-muted/40 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">Total tracked</span>
              <span className="text-sm font-semibold text-primary">
                {formatMinutes(log.totalTrackedMinutes)}
              </span>
            </div>
          )}
        </>
      )}

      {!isPending && !log && (
        <p className="text-sm text-muted-foreground text-center py-4">No data for this day.</p>
      )}
    </div>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto px-6 pb-6">
          <DialogHeader className="mb-4">
            <DialogTitle>Day Log — {dateStr}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto rounded-t-3xl px-4 pb-10">
        <SheetHeader className="mb-4" showHandle>
          <SheetTitle>Day Log — {dateStr}</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
