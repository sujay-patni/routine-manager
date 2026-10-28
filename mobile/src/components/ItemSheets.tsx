import { useState } from "react";
import type { AppEvent, Group, Habit } from "@/lib/types";
import { Chips, Sheet } from "./ui";
import HabitForm from "./HabitForm";
import EventForm, { type EventKind } from "./EventForm";

export type AddTab = "habit" | EventKind;

const TABS: { value: AddTab; label: string }[] = [
  { value: "habit", label: "Habit" },
  { value: "timed", label: "Event" },
  { value: "all_day", label: "Task" },
  { value: "deadline", label: "Deadline" },
];

export function AddItemSheet({ open, onClose, defaultTab = "habit", defaultDate, groups, progressUnits }: {
  open: boolean;
  onClose: () => void;
  defaultTab?: AddTab;
  defaultDate?: string;
  groups: Group[];
  progressUnits: string[];
}) {
  const [tab, setTab] = useState<AddTab>(defaultTab);
  // Bump to remount the form (clears it) each time the sheet opens.
  const [formKey, setFormKey] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTab(defaultTab);
      setFormKey((k) => k + 1);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add to your routine">
      <Chips options={TABS} value={tab} onChange={(t) => { setTab(t); setFormKey((k) => k + 1); }} />
      {tab === "habit" ? (
        <HabitForm key={formKey} groups={groups} progressUnits={progressUnits} onDone={onClose} />
      ) : (
        <EventForm key={formKey} kind={tab} groups={groups} defaultDate={defaultDate} onDone={onClose} />
      )}
    </Sheet>
  );
}

export function EditHabitSheet({ habit, onClose, groups, progressUnits }: {
  habit: Habit | null;
  onClose: () => void;
  groups: Group[];
  progressUnits: string[];
}) {
  return (
    <Sheet open={!!habit} onClose={onClose} title="Edit habit">
      {habit ? <HabitForm key={habit.id} habit={habit} groups={groups} progressUnits={progressUnits} onDone={onClose} /> : null}
    </Sheet>
  );
}

export function EditEventSheet({ event, onClose, groups }: {
  event: AppEvent | null;
  onClose: () => void;
  groups: Group[];
}) {
  const label = event?.event_type === "timed" ? "Edit event" : event?.event_type === "all_day" ? "Edit task" : "Edit deadline";
  return (
    <Sheet open={!!event} onClose={onClose} title={label}>
      {event ? <EventForm key={event.id} kind={event.event_type} event={event} groups={groups} onDone={onClose} /> : null}
    </Sheet>
  );
}
