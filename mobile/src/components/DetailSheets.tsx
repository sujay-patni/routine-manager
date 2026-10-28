// Read-only detail views, ported from the web app's HabitDetailSheet and
// EventDetailSheet. Each has an Edit button that hands off to the edit sheet.
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { format, parseISO } from "date-fns";
import type { AppEvent, Group, Habit } from "@/lib/types";
import { radius, useColors } from "@/lib/theme";
import { fmtClock, fmtIsoTime } from "@/lib/format";
import { Button, Sheet, Txt } from "./ui";

const FREQ_LABELS: Record<string, string> = {
  daily: "Every day",
  weekly: "Weekly",
  specific_days_weekly: "Specific days of the week",
  specific_dates_monthly: "Specific dates each month",
  specific_dates_yearly: "Specific dates each year",
};
const PERIOD_LABELS: Record<string, string> = { daily: "per day", weekly: "per week", monthly: "per month", yearly: "per year" };
const DAY_ABBR: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
const TIME_OF_DAY: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
const TYPE_LABELS: Record<AppEvent["event_type"], string> = { timed: "Event", all_day: "Task", deadline: "Deadline" };
const TYPE_ICON: Record<AppEvent["event_type"], string> = { timed: "📅", all_day: "📋", deadline: "⏰" };
const HEALTH_LABELS: Record<string, string> = {
  steps: "Steps",
  sleep_minutes: "Sleep minutes",
  distance_meters: "Distance (meters)",
  active_calories: "Active calories",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Txt size={12} muted style={{ width: 104, paddingTop: 2 }}>{label}</Txt>
      <View style={{ flex: 1 }}>{typeof children === "string" ? <Txt>{children}</Txt> : children}</View>
    </View>
  );
}

function Description({ text }: { text: string | null }) {
  const c = useColors();
  if (!text) return <Txt muted style={{ fontStyle: "italic" }}>No description added.</Txt>;
  return (
    <View style={{ backgroundColor: c.muted, borderRadius: radius.md, padding: 14 }}>
      <Txt style={{ lineHeight: 21 }}>{text}</Txt>
    </View>
  );
}

function GroupRow({ groupId, groups }: { groupId: string | null; groups: Group[] }) {
  const g = groups.find((x) => x.id === groupId);
  if (!g) return null;
  return (
    <Row label="Group">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: g.color }} />
        <Txt>{g.name}</Txt>
      </View>
    </Row>
  );
}

function specificDaysLabel(h: Habit): string | null {
  if (!h.specific_days) return null;
  const parts = h.specific_days.split(",").map((s) => s.trim());
  if (h.frequency === "specific_days_weekly") return parts.map((d) => DAY_ABBR[d] ?? d).join(", ");
  if (h.frequency === "specific_dates_monthly") {
    return parts.map((d) => {
      const n = parseInt(d, 10);
      const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
      return `${n}${suffix}`;
    }).join(", ") + " of each month";
  }
  if (h.frequency === "specific_dates_yearly") {
    return parts.map((s) => {
      const [mo, d] = s.split("-");
      return format(new Date(2000, parseInt(mo, 10) - 1, parseInt(d, 10)), "MMM d");
    }).join(", ");
  }
  return null;
}

export function HabitDetailSheet({ habit, groups, onClose, onEdit }: {
  habit: Habit | null;
  groups: Group[];
  onClose: () => void;
  onEdit: (h: Habit) => void;
}) {
  const days = habit ? specificDaysLabel(habit) : null;
  return (
    <Sheet open={!!habit} onClose={onClose} title={habit?.name}>
      {habit ? (
        <>
          <Description text={habit.description} />
          <View style={{ gap: 12 }}>
            <Row label="Frequency">{FREQ_LABELS[habit.frequency] ?? habit.frequency}</Row>
            {days ? <Row label="On">{days}</Row> : null}
            {habit.frequency === "weekly" && habit.weekly_target ? <Row label="Weekly target">{`${habit.weekly_target}× per week`}</Row> : null}
            {habit.time_of_day ? <Row label="Time of day">{TIME_OF_DAY[habit.time_of_day] ?? habit.time_of_day}</Row> : null}
            {habit.exact_time ? <Row label="Exact time">{fmtClock(habit.exact_time)}</Row> : null}
            {habit.duration_minutes != null ? <Row label="Duration">{`~${habit.duration_minutes} min`}</Row> : null}
            {habit.progress_metric && habit.progress_target != null ? (
              <Row label="Progress goal">
                {`${habit.progress_start ?? 0} → ${habit.progress_target} ${habit.progress_metric} ${PERIOD_LABELS[habit.progress_period ?? "daily"] ?? ""}`}
              </Row>
            ) : null}
            {habit.health_source ? <Row label="Health Connect">{HEALTH_LABELS[habit.health_source] ?? habit.health_source}</Row> : null}
            <GroupRow groupId={habit.group_id} groups={groups} />
            {!habit.is_active ? <Row label="Status">Paused</Row> : null}
          </View>
          <Button title="Edit habit" variant="secondary" icon="create-outline" onPress={() => onEdit(habit)} />
        </>
      ) : null}
    </Sheet>
  );
}

function fmtDateTime(iso: string) {
  return `${format(new Date(iso), "MMM d, yyyy")} at ${fmtIsoTime(iso)}`;
}

export function EventDetailSheet({ event, groups, onClose, onEdit }: {
  event: AppEvent | null;
  groups: Group[];
  onClose: () => void;
  onEdit: (e: AppEvent) => void;
}) {
  const c = useColors();
  return (
    <Sheet open={!!event} onClose={onClose} title={event?.title}>
      {event ? (
        <>
          <Description text={event.description} />
          <View style={{ gap: 12 }}>
            <Row label="Type">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text>{TYPE_ICON[event.event_type]}</Text>
                <Txt>{TYPE_LABELS[event.event_type]}</Txt>
                {event.is_recurring ? (
                  <View style={{ backgroundColor: c.muted, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Txt size={11}>Repeats</Txt>
                  </View>
                ) : null}
              </View>
            </Row>
            {event.event_type === "timed" && event.start_time ? <Row label="Starts">{fmtDateTime(event.start_time)}</Row> : null}
            {event.event_type === "timed" && event.end_time ? <Row label="Ends">{fmtDateTime(event.end_time)}</Row> : null}
            {event.due_date ? (
              <Row label={event.event_type === "deadline" ? "Due date" : "Date"}>
                {`${format(parseISO(event.due_date), "MMMM d, yyyy")}${event.due_time ? ` at ${fmtClock(event.due_time)}` : ""}`}
              </Row>
            ) : null}
            {event.time_of_day && event.event_type !== "timed" ? <Row label="Time of day">{TIME_OF_DAY[event.time_of_day] ?? event.time_of_day}</Row> : null}
            {event.duration_minutes != null ? <Row label="Duration">{`~${event.duration_minutes} min`}</Row> : null}
            {event.event_type === "deadline" ? <Row label="Shows up">{`${event.surface_days} day${event.surface_days === 1 ? "" : "s"} before`}</Row> : null}
            <GroupRow groupId={event.group_id} groups={groups} />
            {event.is_completed ? (
              <Row label="Status"><Txt weight="600" style={{ color: c.success }}>Completed ✓</Txt></Row>
            ) : null}
          </View>
          <Button title="Edit" variant="secondary" icon="create-outline" onPress={() => onEdit(event)} />
        </>
      ) : null}
    </Sheet>
  );
}
