"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { AppEvent } from "@/lib/notion/types";
import { deleteEvent, completeEvent } from "@/app/actions/events";
import AddItemSheet from "@/components/AddItemSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type EventRow = AppEvent;

interface Props {
  events: EventRow[];
  timezone: string;
}

function getEventDate(event: EventRow, timezone: string): Date | null {
  if (event.start_time) return toZonedTime(new Date(event.start_time), timezone);
  if (event.due_date) return toZonedTime(parseISO(event.due_date), timezone);
  return null;
}

function formatDateGroup(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function formatTime(timeStr: string | null, timezone: string): string {
  if (!timeStr) return "";
  const d = toZonedTime(new Date(timeStr), timezone);
  return format(d, "h:mm a");
}

interface GroupedEvents {
  label: string;
  date: Date;
  events: EventRow[];
}

function groupEventsByDate(events: EventRow[], timezone: string): GroupedEvents[] {
  const map = new Map<string, { date: Date; events: EventRow[] }>();

  for (const event of events) {
    const date = getEventDate(event, timezone);
    if (!date) continue;
    const key = format(date, "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, { date, events: [] });
    }
    map.get(key)!.events.push(event);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => ({
      label: formatDateGroup(val.date),
      date: val.date,
      events: val.events,
    }));
}

export default function ScheduleClient({ events, timezone }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  const groups = groupEventsByDate(events, timezone);

  async function handleComplete() {
    if (!selected) return;
    setActionLoading(true);
    await completeEvent(selected.id);
    setActionLoading(false);
    setSelected(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    setActionLoading(true);
    await deleteEvent(selected.id);
    setActionLoading(false);
    setSelected(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">Schedule</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 max-w-lg mx-auto w-full space-y-6">
        {groups.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">📅</p>
            <p className="text-lg font-semibold">Nothing scheduled</p>
            <p className="text-sm text-muted-foreground">Tap + to add an event or deadline.</p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelected(event)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-xl border bg-card text-left transition-all active:scale-[0.98]",
                    event.is_completed && "opacity-50"
                  )}
                >
                  <span className="text-xl flex-shrink-0">
                    {event.event_type === "deadline" ? (
                      isPast(getEventDate(event, timezone)!) ? "🔴" : "⏰"
                    ) : event.event_type === "all_day" ? "📋" : "📅"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium truncate", event.is_completed && "line-through")}>
                        {event.title}
                      </span>
                      {event.is_recurring && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">↺</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.event_type === "timed" && formatTime(event.start_time, timezone)}
                      {event.event_type === "all_day" && "All day"}
                      {event.event_type === "deadline" && `Due ${format(parseISO(event.due_date!), "MMM d")}`}
                    </p>
                  </div>
                  {event.event_type === "deadline" && !event.is_completed && (
                    <Badge
                      variant={isPast(getEventDate(event, timezone)!) ? "destructive" : "secondary"}
                      className="text-xs flex-shrink-0"
                    >
                      {isPast(getEventDate(event, timezone)!) ? "overdue" : "deadline"}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:bg-primary/90 active:scale-95 transition-all z-40"
        aria-label="Add event"
      >
        +
      </button>

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} defaultTab="timed" />

      {/* Event detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <span>
                {selected?.event_type === "deadline" ? "⏰" : selected?.event_type === "all_day" ? "📋" : "📅"}
              </span>
              {selected?.title}
            </SheetTitle>
          </SheetHeader>
          {selected?.description && (
            <p className="text-sm text-muted-foreground mb-4">{selected.description}</p>
          )}
          <div className="text-sm text-muted-foreground mb-6 space-y-1">
            {selected?.event_type === "timed" && selected.start_time && (
              <p>🕐 {formatTime(selected.start_time, timezone)}
                {selected.end_time && ` – ${formatTime(selected.end_time, timezone)}`}
              </p>
            )}
            {selected?.due_date && (
              <p>📆 Due {format(parseISO(selected.due_date), "MMMM d, yyyy")}</p>
            )}
            {selected?.is_recurring && <p>↺ Recurring</p>}
          </div>
          <div className="flex gap-3">
            {!selected?.is_completed && (
              <Button onClick={handleComplete} disabled={actionLoading} className="flex-1">
                Mark complete
              </Button>
            )}
            <Button
              onClick={handleDelete}
              disabled={actionLoading}
              variant="destructive"
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
