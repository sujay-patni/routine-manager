"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AppEvent } from "@/lib/notion/types";

interface EventDetailSheetProps {
  event: AppEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  timed: "Timed Event",
  all_day: "Task",
  deadline: "Deadline",
};

const TIME_OF_DAY_LABELS: Record<string, string> = {
  morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night",
};

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const timeStr = `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${dateStr} at ${timeStr}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm flex-1">{value}</span>
    </div>
  );
}

export default function EventDetailSheet({ event, open, onOpenChange, onEdit }: EventDetailSheetProps) {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!event) return null;

  const icon = event.event_type === "deadline" ? "⏰" : event.event_type === "all_day" ? "📋" : "📅";

  const content = (
    <div className="space-y-5 pt-2">
      {/* Description */}
      {event.description && (
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
        </div>
      )}
      {!event.description && (
        <p className="text-sm text-muted-foreground italic">No description added.</p>
      )}

      {/* Details */}
      <div className="space-y-3">
        <DetailRow label="Type" value={
          <span className="flex items-center gap-1.5">
            <span>{icon}</span>
            <span>{TYPE_LABELS[event.event_type] ?? event.event_type}</span>
            {event.is_recurring && <Badge variant="secondary" className="text-xs">Recurring</Badge>}
          </span>
        } />

        {event.event_type === "timed" && event.start_time && (
          <DetailRow label="Starts" value={formatDateTime(event.start_time)} />
        )}

        {event.event_type === "timed" && event.end_time && (
          <DetailRow label="Ends" value={formatDateTime(event.end_time)} />
        )}

        {event.due_date && (
          <DetailRow
            label={event.event_type === "deadline" ? "Due date" : "Date"}
            value={
              <span>
                {formatDate(event.due_date)}
                {event.due_time && <span className="text-muted-foreground ml-1">at {formatTime(event.due_time)}</span>}
              </span>
            }
          />
        )}

        {event.time_of_day && !event.due_time && event.event_type !== "timed" && (
          <DetailRow label="Time of day" value={TIME_OF_DAY_LABELS[event.time_of_day] ?? event.time_of_day} />
        )}

        {event.is_completed && (
          <DetailRow label="Status" value={<span className="text-emerald-600 font-medium">Completed ✓</span>} />
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => { onOpenChange(false); onEdit(); }}
        >
          Edit
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe-offset-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">{event.title}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
