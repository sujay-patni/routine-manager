import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { completeHabit, logHabitProgress, uncompleteHabit } from "@/lib/services/habits";
import type { ProcessedHabit } from "@/lib/habit-logic";
import type { Group } from "@/lib/types";
import { radius, useColors } from "@/lib/theme";
import { fmtClock, toastError } from "@/lib/format";
import { Button, IconButton, NumberInput, ProgressBar, Txt } from "./ui";

const PERIOD_LABELS: Record<string, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
};

const TIME_UNITS = new Set(["mins", "hrs"]);
const isTimeUnit = (u: string | null | undefined) => u != null && TIME_UNITS.has(u.toLowerCase());

function progressToMinutes(value: number, unit: string | null | undefined, conversion: number | null | undefined): number {
  if (!unit) return Math.round(value);
  const u = unit.toLowerCase();
  if (u === "hrs") return Math.round(value * 60);
  if (u === "mins") return Math.round(value);
  return Math.round(value * (conversion ?? 1));
}

interface Props {
  habit: ProcessedHabit;
  today: string;
  groups: Group[];
  onSkip?: () => void;
  onUnskip?: () => void;
  onEdit?: () => void;
}

export default function HabitCard({ habit, today, groups, onSkip, onUnskip, onEdit }: Props) {
  const c = useColors();
  const [localDone, setLocalDone] = useState(habit.completed_today > 0);
  const [localProgress, setLocalProgress] = useState(habit.today_progress ?? 0);
  const [localContribution, setLocalContribution] = useState(habit.today_contribution ?? 0);
  const [editor, setEditor] = useState<"none" | "progress" | "time">("none");
  const [inputVal, setInputVal] = useState("");
  const [timeVal, setTimeVal] = useState("");

  // Re-sync when fresh data arrives from the database (adjust-state-on-prop-change pattern).
  const sourceKey = `${today}|${habit.completed_today}|${habit.today_progress}|${habit.today_contribution}`;
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  if (sourceKey !== prevSourceKey) {
    setPrevSourceKey(sourceKey);
    setLocalDone(habit.completed_today > 0);
    setLocalProgress(habit.today_progress ?? 0);
    setLocalContribution(habit.today_contribution ?? 0);
  }

  const hasProgress = habit.progress_metric != null && habit.progress_target != null;
  const timeBased = isTimeUnit(habit.progress_metric);
  const isSkipped = habit.is_skipped === true;
  const isProgressDone = hasProgress && localProgress >= (habit.progress_target ?? 0);
  const done = hasProgress ? isProgressDone : localDone;
  const groupColor = groups.find((g) => g.id === habit.group_id)?.color;

  async function toggle() {
    if (hasProgress) return;
    const next = !localDone;
    setLocalDone(next);
    try {
      if (next) await completeHabit(habit.id, today, habit.name, habit.duration_minutes ?? undefined);
      else await uncompleteHabit(habit.id, today);
    } catch (e) {
      setLocalDone(!next);
      toastError("Couldn't save habit", e);
    }
  }

  function openProgress() {
    setInputVal(String(localContribution || ""));
    if (!timeBased) {
      const prefill = progressToMinutes(localContribution, habit.progress_metric, habit.progress_conversion);
      setTimeVal(prefill > 0 ? String(prefill) : "");
    }
    setEditor("progress");
  }

  function openLogTime() {
    setTimeVal(habit.duration_minutes != null ? String(habit.duration_minutes) : "");
    setEditor("time");
  }

  async function saveProgress() {
    const raw = Math.max(0, Math.min((habit.progress_target ?? 0) * 2, Number(inputVal) || 0));
    const contrib = Math.round(raw * 100) / 100;
    const total = localProgress - localContribution + contrib;
    setLocalProgress(total);
    setLocalContribution(contrib);
    setEditor("none");
    let duration: number | undefined;
    if (timeBased) duration = progressToMinutes(contrib, habit.progress_metric, habit.progress_conversion);
    else if (timeVal !== "" && Number(timeVal) > 0) duration = Math.round(Number(timeVal));
    const result = await logHabitProgress(habit.id, today, habit.name, contrib, duration);
    if (result?.error) {
      setLocalProgress(habit.today_progress ?? 0);
      setLocalContribution(habit.today_contribution ?? 0);
      toastError("Couldn't log progress", result.error);
    }
  }

  async function saveLogTime() {
    const v = Number(timeVal);
    setEditor("none");
    setLocalDone(true);
    try {
      await completeHabit(habit.id, today, habit.name, v > 0 ? v : undefined);
    } catch (e) {
      setLocalDone(habit.completed_today > 0);
      toastError("Couldn't save habit", e);
    }
  }

  const weeklyProgress =
    habit.frequency === "weekly" || habit.frequency === "specific_days_weekly"
      ? `${habit.completions_this_week}/${habit.target} this week`
      : null;
  const range = (habit.progress_target ?? 0) - (habit.progress_start ?? 0);
  const pct = range > 0 ? ((localProgress - (habit.progress_start ?? 0)) / range) * 100 : 0;
  const canLogTime = !hasProgress && !done && !isSkipped;
  const dim = done || isSkipped || habit.state === "satisfied";

  return (
    <Pressable
      onPress={editor === "none" ? onEdit : undefined}
      onLongPress={canLogTime ? openLogTime : undefined}
      accessibilityHint={canLogTime ? "Long press to log time" : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: habit.state === "urgent" && !done ? c.urgentBorder : c.border,
          opacity: dim ? 0.6 : pressed ? 0.85 : 1,
        },
        groupColor ? { borderLeftWidth: 3, borderLeftColor: groupColor } : null,
      ]}
    >
      <View style={styles.row}>
        {!hasProgress && !isSkipped ? (
          <Pressable
            onPress={toggle}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`Mark ${habit.name} ${done ? "not done" : "done"}`}
          >
            <View style={[styles.check, { borderColor: done ? c.success : c.mutedForeground, backgroundColor: done ? c.success : "transparent" }]}>
              {done ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
            </View>
          </Pressable>
        ) : null}
        {isSkipped ? (
          <View style={[styles.check, { borderColor: c.border }]} accessibilityLabel="Skipped">
            <Ionicons name="play-skip-forward" size={12} color={c.mutedForeground} />
          </View>
        ) : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <Txt weight="600" style={(done || isSkipped) && { textDecorationLine: "line-through", color: c.mutedForeground }}>
              {habit.name}
            </Txt>
            {habit.exact_time ? <Txt size={12} muted>· {fmtClock(habit.exact_time)}</Txt> : null}
            {!hasProgress && habit.duration_minutes != null ? <Txt size={12} muted>· ~{habit.duration_minutes}m</Txt> : null}
            {habit.health_source ? <Ionicons name="pulse" size={13} color={c.success} accessibilityLabel="Synced from Health Connect" /> : null}
            {habit.state === "optional" ? <Txt size={11} muted>optional</Txt> : null}
            {habit.state === "satisfied" ? <Txt size={11} style={{ color: c.success }}>week done ✓</Txt> : null}
          </View>
          {weeklyProgress ? <Txt size={12} muted>{weeklyProgress}</Txt> : null}
        </View>

        {!done && !isSkipped && onSkip ? <IconButton icon="play-skip-forward-outline" size={17} onPress={onSkip} label="Skip habit" /> : null}
        {isSkipped && onUnskip ? <Button title="Undo" variant="ghost" onPress={onUnskip} style={{ paddingVertical: 4, paddingHorizontal: 8 }} /> : null}
        {hasProgress && !isProgressDone && !isSkipped ? (
          <IconButton icon="add-circle-outline" size={24} color={c.primary} onPress={openProgress} label="Log progress" />
        ) : null}
        {hasProgress && isProgressDone ? (
          <Pressable onPress={openProgress} accessibilityLabel="Edit progress">
            <View style={[styles.check, { borderColor: c.success, backgroundColor: c.success }]}>
              <Ionicons name="checkmark" size={15} color="#fff" />
            </View>
          </Pressable>
        ) : null}
      </View>

      {hasProgress ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt size={12} muted>
              {localProgress} / {habit.progress_target} {habit.progress_metric}
              {habit.progress_period && habit.progress_period !== "daily" ? `  ${PERIOD_LABELS[habit.progress_period]}` : ""}
            </Txt>
            {isProgressDone ? <Txt size={12} weight="600" style={{ color: c.success }}>Done ✓</Txt> : null}
          </View>
          <ProgressBar pct={pct} done={isProgressDone} />
        </View>
      ) : null}

      {editor !== "none" ? (
        <View style={[styles.editor, { borderTopColor: c.border }]}>
          {editor === "progress" ? (
            <View style={styles.editorRow}>
              <NumberInput value={inputVal} onChangeText={(v) => {
                setInputVal(v);
                if (!timeBased) setTimeVal(String(progressToMinutes(Number(v) || 0, habit.progress_metric, habit.progress_conversion) || ""));
              }} autoFocus style={{ width: 96 }} onSubmitEditing={saveProgress} />
              <Txt size={12} muted style={{ flex: 1 }}>{habit.progress_metric} today</Txt>
            </View>
          ) : null}
          {editor === "time" || !timeBased ? (
            <View style={styles.editorRow}>
              <Ionicons name="time-outline" size={16} color={c.mutedForeground} />
              <NumberInput value={timeVal} onChangeText={setTimeVal} placeholder="min" autoFocus={editor === "time"} style={{ width: 80 }} />
              <Txt size={12} muted style={{ flex: 1 }}>{editor === "time" ? "min" : "min (optional)"}</Txt>
            </View>
          ) : null}
          <View style={[styles.editorRow, { justifyContent: "flex-end" }]}>
            <Button title="Cancel" variant="ghost" onPress={() => setEditor("none")} style={{ paddingVertical: 6 }} />
            <Button title="Save" onPress={editor === "progress" ? saveProgress : saveLogTime} style={{ paddingVertical: 6 }} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  editor: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  editorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
