import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { createEvent, deleteEvent, updateEvent } from "@/lib/services/events";
import { getEvent } from "@/lib/db/events";
import type { AppEvent, Group } from "@/lib/types";
import { localDateStr, localTimeStr, toast, toastError } from "@/lib/format";
import { Button, Chips, DateField, Field, Input, NumberInput, Select, TimeField } from "./ui";
import { DAYS_OF_WEEK, TimingField, groupOptions } from "./HabitForm";

export type EventKind = AppEvent["event_type"];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "weekdays", label: "Weekdays only" },
  { value: "specific_days", label: "Specific days (weekly)" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const SURFACE_OPTIONS = [
  { value: "1", label: "1 day before" },
  { value: "2", label: "2 days before" },
  { value: "3", label: "3 days before" },
  { value: "5", label: "5 days before" },
  { value: "7", label: "1 week before" },
  { value: "14", label: "2 weeks before" },
  { value: "30", label: "1 month before" },
];

function buildRRule(r: string, days: string[]): string | undefined {
  switch (r) {
    case "daily": return "FREQ=DAILY";
    case "weekly": return "FREQ=WEEKLY";
    case "weekdays": return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "specific_days": return days.length ? `FREQ=WEEKLY;BYDAY=${days.join(",")}` : "FREQ=WEEKLY";
    case "monthly": return "FREQ=MONTHLY";
    case "yearly": return "FREQ=YEARLY";
    default: return undefined;
  }
}

/** Local date + "HH:mm" → ISO timestamp. */
function localIso(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function baseId(id: string) {
  return id.split("_")[0];
}

interface Props {
  kind: EventKind;
  event?: AppEvent | null;
  groups: Group[];
  defaultDate?: string;
  onDone: () => void;
}

export default function EventForm({ kind, event, groups, defaultDate, onDone }: Props) {
  const editing = !!event;
  const isInstance = !!event && event.is_recurring && event.id.includes("_");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const startDate = event?.start_time ? new Date(event.start_time) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [desc, setDesc] = useState(event?.description ?? "");
  const [date, setDate] = useState(
    startDate ? localDateStr(startDate) : event?.due_date ?? defaultDate ?? localDateStr()
  );
  const [time, setTime] = useState(startDate ? localTimeStr(startDate) : "09:00");
  const initialDuration =
    event?.duration_minutes ??
    (event?.start_time && event.end_time
      ? Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000)
      : null);
  const [duration, setDuration] = useState(initialDuration && initialDuration > 0 ? String(initialDuration) : "");
  const [dueTime, setDueTime] = useState(event?.due_time ?? "");
  const [useExact, setUseExact] = useState(!!event?.due_time);
  const [timeOfDay, setTimeOfDay] = useState<string>(event?.time_of_day ?? "");
  const [surfaceDays, setSurfaceDays] = useState(String(event?.surface_days ?? 3));
  const [recurrence, setRecurrence] = useState("none");
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [groupId, setGroupId] = useState(event?.group_id ?? "");

  // A repeating event's start date anchors the whole series, so edits to one
  // occurrence keep the series' original start date.
  const [seriesStart, setSeriesStart] = useState<string | null>(null);
  useEffect(() => {
    if (!isInstance || !event) return;
    getEvent(baseId(event.id)).then((base) => {
      if (base?.start_time) setSeriesStart(localDateStr(new Date(base.start_time)));
      if (base?.due_date && kind !== "timed") setDate(base.due_date);
    });
  }, [isInstance, event, kind]);

  async function save() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (!date) e.date = "Date is required";
    if (recurrence === "specific_days" && repeatDays.length === 0) e.repeatDays = "Pick at least one day";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (isInstance && kind === "timed" && !seriesStart) return; // series not loaded yet

    const mins = duration ? Number(duration) : undefined;
    setBusy(true);
    let result: { success?: boolean; error?: string };

    if (editing) {
      const data: Parameters<typeof updateEvent>[1] = {
        title: title.trim(),
        description: desc.trim(),
        duration_minutes: mins ?? null,
        group_id: groupId || null,
      };
      if (kind === "timed") {
        const start = localIso(isInstance && seriesStart ? seriesStart : date, time);
        data.start_time = start;
        data.end_time = mins ? addMinutes(start, mins) : null;
      } else if (kind === "all_day") {
        if (!isInstance) data.due_date = date;
        data.time_of_day = useExact ? null : timeOfDay || null;
        data.due_time = useExact ? dueTime || null : null;
      } else {
        data.due_date = date;
        data.due_time = dueTime || null;
        data.surface_days = Number(surfaceDays);
      }
      result = await updateEvent(baseId(event!.id), data);
    } else {
      const rrule = kind === "deadline" ? undefined : buildRRule(recurrence, repeatDays);
      const common = {
        title: title.trim(),
        description: desc.trim() || undefined,
        duration_minutes: mins,
        group_id: groupId || null,
      };
      if (kind === "timed") {
        const start = localIso(date, time);
        result = await createEvent({
          ...common,
          event_type: "timed",
          start_time: start,
          end_time: mins ? addMinutes(start, mins) : undefined,
          is_recurring: !!rrule,
          recurrence_rule: rrule,
        });
      } else if (kind === "all_day") {
        result = await createEvent({
          ...common,
          event_type: "all_day",
          due_date: date,
          time_of_day: useExact ? undefined : timeOfDay || undefined,
          due_time: useExact ? dueTime || undefined : undefined,
          is_recurring: !!rrule,
          recurrence_rule: rrule,
        });
      } else {
        result = await createEvent({
          ...common,
          event_type: "deadline",
          due_date: date,
          due_time: dueTime || undefined,
          surface_days: Number(surfaceDays),
        });
      }
    }
    setBusy(false);
    if (result.error) return toastError("Couldn't save", result.error);
    toast(editing ? "Saved" : `${kind === "timed" ? "Event" : kind === "all_day" ? "Task" : "Deadline"} added`);
    onDone();
  }

  function confirmDelete() {
    if (!event) return;
    const doDelete = async (excludeDate?: string) => {
      const r = await deleteEvent(event.id, excludeDate);
      if (r.error) return toastError("Couldn't delete", r.error);
      toast("Deleted");
      onDone();
    };
    if (isInstance) {
      Alert.alert("Delete repeating item", "Delete only this occurrence, or the whole series?", [
        { text: "Cancel", style: "cancel" },
        { text: "This one", onPress: () => doDelete(event.id.split("_")[1]) },
        { text: "All", style: "destructive", onPress: () => doDelete() },
      ]);
    } else {
      Alert.alert("Delete?", `"${event.title}" will be removed from this phone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete() },
      ]);
    }
  }

  const titleLabel = kind === "timed" ? "Title" : kind === "all_day" ? "Task" : "What's the deadline?";
  const placeholder = kind === "timed" ? "e.g. Team standup" : kind === "all_day" ? "e.g. Submit report" : "e.g. File taxes";

  return (
    <View style={{ gap: 16 }}>
      <Field label={titleLabel} error={errors.title}>
        <Input value={title} onChangeText={setTitle} placeholder={placeholder} invalid={!!errors.title} />
      </Field>

      {kind === "timed" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!isInstance ? (
            <View style={{ flex: 1 }}>
              <Field label="Date" error={errors.date}><DateField value={date} onChange={setDate} /></Field>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Field label="Start time"><TimeField value={time} onChange={setTime} /></Field>
          </View>
        </View>
      ) : !isInstance ? (
        <Field label={kind === "deadline" ? "Due date" : "Date"} error={errors.date}>
          <DateField value={date} onChange={setDate} />
        </Field>
      ) : null}

      {kind === "all_day" ? (
        <TimingField useExact={useExact} setUseExact={setUseExact} timeOfDay={timeOfDay} setTimeOfDay={setTimeOfDay} exactTime={dueTime} setExactTime={setDueTime} />
      ) : null}

      {kind === "deadline" ? (
        <>
          <Field label="Due time" hint="(optional)"><TimeField value={dueTime} onChange={setDueTime} clearable /></Field>
          <Field label="Start reminding me">
            <Select value={surfaceDays} title="Start reminding me" options={SURFACE_OPTIONS} onChange={setSurfaceDays} />
          </Field>
        </>
      ) : null}

      {!editing && kind !== "deadline" ? (
        <Field label="Repeat" error={errors.repeatDays}>
          <View style={{ gap: 8 }}>
            <Select value={recurrence} title="Repeat" options={RECURRENCE_OPTIONS} onChange={setRecurrence} />
            {recurrence === "specific_days" ? (
              <Chips multiple options={DAYS_OF_WEEK} value={repeatDays} onChange={(d) => setRepeatDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))} />
            ) : null}
          </View>
        </Field>
      ) : null}

      <Field label={kind === "timed" ? "Duration (min)" : "Default duration (min)"} hint="(optional)">
        <NumberInput value={duration} onChangeText={setDuration} placeholder="e.g. 60" />
      </Field>

      <Field label="Notes" hint="(optional)">
        <Input value={desc} onChangeText={setDesc} placeholder="Any details…" multiline />
      </Field>

      {groups.length > 0 ? (
        <Field label="Group"><Select value={groupId} title="Group" options={groupOptions(groups)} onChange={setGroupId} /></Field>
      ) : null}

      <Button title={editing ? "Save changes" : kind === "timed" ? "Add event" : kind === "all_day" ? "Add task" : "Add deadline"} onPress={save} loading={busy} />
      {editing ? <Button title="Delete" variant="danger" onPress={confirmDelete} /> : null}
    </View>
  );
}
