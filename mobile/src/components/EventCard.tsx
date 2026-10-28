import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setEventCompleted, type TodayEvent } from "@/lib/services/events";
import type { Group } from "@/lib/types";
import { radius, useColors } from "@/lib/theme";
import { fmtClock, fmtIsoTime, toastError } from "@/lib/format";
import { Button, IconButton, NumberInput, Txt } from "./ui";

const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function defaultDuration(e: TodayEvent): number | null {
  if (e.duration_minutes != null) return e.duration_minutes;
  if (e.event_type === "timed" && e.start_time && e.end_time) {
    const diff = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
    if (diff > 0) return Math.round(diff / 60000);
  }
  return null;
}

function subtitle(e: TodayEvent): string {
  if (e.event_type === "timed") {
    return fmtIsoTime(e.start_time) + (e.end_time ? ` – ${fmtIsoTime(e.end_time)}` : "");
  }
  if (e.event_type === "all_day") {
    if (e.due_time) return fmtClock(e.due_time);
    if (e.time_of_day) return TIME_OF_DAY_LABEL[e.time_of_day] ?? "All day";
    return "All day";
  }
  if (e.isOverdue) {
    const d = Math.abs(e.daysUntilDue ?? 0);
    return `Overdue by ${d} day${d !== 1 ? "s" : ""}`;
  }
  if (e.daysUntilDue === 0) return e.due_time ? `Due today · ${fmtClock(e.due_time)}` : "Due today";
  return `Due in ${e.daysUntilDue} day${e.daysUntilDue !== 1 ? "s" : ""}`;
}

interface Props {
  event: TodayEvent;
  groups: Group[];
  onSkip?: () => void;
  onUnskip?: () => void;
  onEdit?: () => void;
  onView?: () => void;
}

export default function EventCard({ event, groups, onSkip, onUnskip, onEdit, onView }: Props) {
  const c = useColors();
  const [done, setDone] = useState(event.is_completed);
  const [logOpen, setLogOpen] = useState(false);
  const [timeVal, setTimeVal] = useState("");
  const [prevCompleted, setPrevCompleted] = useState(event.is_completed);
  if (event.is_completed !== prevCompleted) {
    setPrevCompleted(event.is_completed);
    setDone(event.is_completed);
  }

  const isSkipped = event.is_skipped === true;
  const isDeadline = event.event_type === "deadline";
  const groupColor = groups.find((g) => g.id === event.group_id)?.color;
  const icon = isDeadline ? (event.isOverdue ? "🔴" : "⏰") : event.event_type === "all_day" ? "📋" : "📅";

  async function setCompleted(next: boolean, duration?: number) {
    setDone(next);
    const result = await setEventCompleted(event.id, next, duration);
    if (result?.error) {
      setDone(!next);
      toastError("Couldn't update", result.error);
    }
  }

  function openLogTime() {
    const d = defaultDuration(event);
    setTimeVal(d != null ? String(d) : "");
    setLogOpen(true);
  }

  const borderColor = isDeadline && event.isOverdue
    ? c.destructive
    : isDeadline && event.daysUntilDue === 0
      ? c.urgentBorder
      : c.border;

  return (
    <Pressable
      onPress={logOpen ? undefined : onView ?? onEdit}
      onLongPress={!done && !isSkipped ? openLogTime : undefined}
      accessibilityHint={!done && !isSkipped ? "Long press to log time" : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDeadline && event.isOverdue ? c.dangerBg : c.card,
          borderColor,
          opacity: done || isSkipped ? 0.55 : pressed ? 0.85 : 1,
        },
        groupColor ? { borderLeftWidth: 3, borderLeftColor: groupColor } : null,
      ]}
    >
      <View style={styles.row}>
        {!isSkipped ? (
          <Pressable
            onPress={() => setCompleted(!done, !done ? defaultDuration(event) ?? undefined : undefined)}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`Mark ${event.title} ${done ? "not done" : "done"}`}
          >
            <View style={[styles.check, { borderColor: done ? c.success : c.mutedForeground, backgroundColor: done ? c.success : "transparent" }]}>
              {done ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
            </View>
          </Pressable>
        ) : (
          <View style={[styles.check, { borderColor: c.border }]} accessibilityLabel="Skipped">
            <Ionicons name="play-skip-forward" size={12} color={c.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text>{icon}</Text>
            <Txt weight="600" numberOfLines={2} style={[{ flexShrink: 1 }, (done || isSkipped) && { textDecorationLine: "line-through", color: c.mutedForeground }]}>
              {event.title}
            </Txt>
          </View>
          <Txt size={12} muted style={isDeadline && event.isOverdue ? { color: c.destructive } : undefined}>
            {subtitle(event)}
            {event.is_recurring ? "  ·  repeats" : ""}
          </Txt>
        </View>
        {!done && !isSkipped && onSkip ? <IconButton icon="play-skip-forward-outline" size={17} onPress={onSkip} label="Skip" /> : null}
        {onView && onEdit ? <IconButton icon="create-outline" size={17} onPress={onEdit} label="Edit" /> : null}
        {isSkipped && onUnskip ? <Button title="Undo" variant="ghost" onPress={onUnskip} style={{ paddingVertical: 4, paddingHorizontal: 8 }} /> : null}
      </View>

      {logOpen ? (
        <View style={[styles.editor, { borderTopColor: c.border }]}>
          <Ionicons name="time-outline" size={16} color={c.mutedForeground} />
          <NumberInput value={timeVal} onChangeText={setTimeVal} placeholder="min" autoFocus style={{ width: 80 }} />
          <Txt size={12} muted style={{ flex: 1 }}>min</Txt>
          <Button title="Cancel" variant="ghost" onPress={() => setLogOpen(false)} style={{ paddingVertical: 6 }} />
          <Button
            title="Save"
            onPress={() => {
              setLogOpen(false);
              const v = parseInt(timeVal, 10);
              setCompleted(true, v > 0 ? v : undefined);
            }}
            style={{ paddingVertical: 6 }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  editor: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 },
});
