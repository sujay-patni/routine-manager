import { useState } from "react";
import { Alert, View } from "react-native";
import { createHabit, deleteHabit, updateHabit } from "@/lib/services/habits";
import type { Group, Habit, HabitFrequency, HealthSource, ProgressPeriod } from "@/lib/types";
import { toast, toastError } from "@/lib/format";
import { Button, Chips, Field, IconButton, Input, NumberInput, Select, TimeField, ToggleRow, Txt } from "./ui";
import { useColors } from "@/lib/theme";

export const DAYS_OF_WEEK = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const TIME_OF_DAY_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "morning", label: "Morning (4 AM–12 PM)" },
  { value: "afternoon", label: "Afternoon (12–4 PM)" },
  { value: "evening", label: "Evening (4–8 PM)" },
  { value: "night", label: "Night (8 PM–4 AM)" },
];

const HEALTH_SOURCES: { value: HealthSource | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "steps", label: "Steps" },
  { value: "sleep_minutes", label: "Sleep minutes" },
  { value: "distance_meters", label: "Distance (meters)" },
  { value: "active_calories", label: "Active calories" },
];

const isTimeUnit = (u: string) => u === "mins" || u === "hrs";

export function groupOptions(groups: Group[]) {
  return [{ value: "", label: "None" }, ...groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))];
}

interface Props {
  habit?: Habit | null;
  groups: Group[];
  progressUnits: string[];
  onDone: () => void;
}

export default function HabitForm({ habit, groups, progressUnits, onDone }: Props) {
  const c = useColors();
  const editing = !!habit;
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(habit?.name ?? "");
  const [desc, setDesc] = useState(habit?.description ?? "");
  const [freq, setFreq] = useState<HabitFrequency>(habit?.frequency ?? "daily");
  const [weeklyTarget, setWeeklyTarget] = useState(String(habit?.weekly_target ?? 3));
  const spec = habit?.specific_days?.split(",").map((s) => s.trim()) ?? [];
  const [days, setDays] = useState<string[]>(habit?.frequency === "specific_days_weekly" ? spec : []);
  const [dates, setDates] = useState<string[]>(habit?.frequency === "specific_dates_monthly" ? spec : []);
  const [yearly, setYearly] = useState<{ month: string; day: string }[]>(
    habit?.frequency === "specific_dates_yearly" && spec.length
      ? spec.map((s) => {
          const [month, day] = s.split("-");
          return { month, day: String(Number(day)) };
        })
      : [{ month: "01", day: "1" }]
  );

  const [progressOn, setProgressOn] = useState(!!habit?.progress_metric);
  const [metric, setMetric] = useState(habit?.progress_metric ?? "mins");
  const convBase = habit?.progress_conversion_base ?? 1;
  const [convLeft, setConvLeft] = useState(String(convBase));
  const [convRight, setConvRight] = useState(String(Math.round(convBase * (habit?.progress_conversion ?? 1) * 10000) / 10000));
  const [target, setTarget] = useState(habit?.progress_target != null ? String(habit.progress_target) : "");
  const [start, setStart] = useState(String(habit?.progress_start ?? 0));
  const [period, setPeriod] = useState<ProgressPeriod>(habit?.progress_period ?? "daily");
  const [healthSource, setHealthSource] = useState<HealthSource | "none">(habit?.health_source ?? "none");

  const [useExact, setUseExact] = useState(!!habit?.exact_time);
  const [timeOfDay, setTimeOfDay] = useState<string>(habit?.time_of_day ?? "");
  const [exactTime, setExactTime] = useState(habit?.exact_time ?? "");
  const [duration, setDuration] = useState(habit?.duration_minutes != null ? String(habit.duration_minutes) : "");
  const [groupId, setGroupId] = useState(habit?.group_id ?? "");

  const units = Array.from(new Set([...(progressUnits.length ? progressUnits : ["mins", "hrs"]), metric]));

  function specificDays(): string | null {
    if (freq === "specific_days_weekly" && days.length) return days.join(",");
    if (freq === "specific_dates_monthly" && dates.length) return dates.join(",");
    if (freq === "specific_dates_yearly" && yearly.length) {
      return yearly.map(({ month, day }) => `${month}-${String(day).padStart(2, "0")}`).join(",");
    }
    return null;
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (freq === "specific_days_weekly" && days.length === 0) e.days = "Pick at least one day";
    if (freq === "specific_dates_monthly" && dates.length === 0) e.dates = "Pick at least one date";
    if (freq === "specific_dates_yearly" && yearly.some(({ day }) => !(Number(day) >= 1 && Number(day) <= 31))) {
      e.yearly = "Day must be between 1 and 31";
    }
    if (progressOn && !(Number(target) > 0)) e.target = "Target is required for progress tracking";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const cl = Number(convLeft) || 1;
    const cr = Number(convRight) || 1;
    const conversion = progressOn && !isTimeUnit(metric) ? cr / cl : null;
    const wt = Math.min(7, Math.max(1, parseInt(weeklyTarget, 10) || 1));
    const payload = {
      name: name.trim(),
      description: desc.trim() || null,
      frequency: freq,
      weekly_target: freq === "weekly" && !progressOn ? wt : null,
      time_of_day: useExact ? null : timeOfDay || null,
      exact_time: useExact ? exactTime || null : null,
      specific_days: specificDays(),
      progress_metric: progressOn ? metric : null,
      progress_target: progressOn ? Number(target) : null,
      progress_start: progressOn ? Number(start) || 0 : null,
      progress_period: progressOn ? period : null,
      progress_conversion: conversion,
      progress_conversion_base: progressOn && !isTimeUnit(metric) ? cl : null,
      duration_minutes: !progressOn && duration ? Number(duration) : null,
      group_id: groupId || null,
      health_source: progressOn && healthSource !== "none" ? healthSource : null,
    };
    setBusy(true);
    const result = editing
      ? await updateHabit(habit!.id, payload)
      : await createHabit({
          ...payload,
          description: payload.description ?? undefined,
          weekly_target: payload.weekly_target ?? undefined,
          time_of_day: payload.time_of_day ?? undefined,
          exact_time: payload.exact_time ?? undefined,
          specific_days: payload.specific_days ?? undefined,
          progress_metric: payload.progress_metric ?? undefined,
          progress_target: payload.progress_target ?? undefined,
          progress_start: payload.progress_start ?? undefined,
          progress_period: payload.progress_period ?? undefined,
          progress_conversion: payload.progress_conversion ?? undefined,
          progress_conversion_base: payload.progress_conversion_base ?? undefined,
          duration_minutes: payload.duration_minutes ?? undefined,
        });
    setBusy(false);
    if (result.error) return toastError("Couldn't save habit", result.error);
    toast(editing ? "Saved" : "Habit added");
    onDone();
  }

  function confirmDelete() {
    if (!habit) return;
    Alert.alert("Delete habit?", `"${habit.name}" and its history will be removed from this phone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const r = await deleteHabit(habit.id);
          if (r.error) return toastError("Couldn't delete habit", r.error);
          toast("Habit deleted");
          onDone();
        },
      },
    ]);
  }

  const freqOptions = [
    { value: "daily" as const, label: "Daily" },
    ...(!progressOn ? [{ value: "weekly" as const, label: "Weekly (with target)" }] : []),
    { value: "specific_days_weekly" as const, label: "Specific days (weekly)" },
    { value: "specific_dates_monthly" as const, label: "Specific dates (monthly)" },
    { value: "specific_dates_yearly" as const, label: "Specific date (yearly)" },
  ];

  return (
    <View style={{ gap: 16 }}>
      <Field label="Name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. Morning run" invalid={!!errors.name} />
      </Field>

      <ToggleRow label="Progress tracking" hint="Count toward a target, like 10,000 steps" value={progressOn} onChange={(v) => {
        setProgressOn(v);
        if (v && freq === "weekly") setFreq("daily");
      }} />

      {progressOn ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="Start"><NumberInput value={start} onChangeText={setStart} placeholder="0" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Target"><NumberInput value={target} onChangeText={setTarget} placeholder="10000" invalid={!!errors.target} /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit">
                <Select value={metric} title="Unit" options={units.map((u) => ({ value: u, label: u }))} onChange={(u) => {
                  setMetric(u);
                  setConvLeft("1");
                  setConvRight("1");
                }} />
              </Field>
            </View>
          </View>
          {errors.target ? <Txt size={12} style={{ color: c.destructive }}>{errors.target}</Txt> : null}
          {!isTimeUnit(metric) ? (
            <Field label="Conversion" hint="(for time tracking)">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <NumberInput value={convLeft} onChangeText={setConvLeft} style={{ width: 70 }} />
                <Txt size={12} muted>{metric} =</Txt>
                <NumberInput value={convRight} onChangeText={setConvRight} style={{ width: 70 }} />
                <Txt size={12} muted>min</Txt>
              </View>
            </Field>
          ) : null}
          <Field label="Progress resets">
            <Select<ProgressPeriod> value={period} title="Progress resets" onChange={setPeriod} options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly (1st of month)" },
              { value: "yearly", label: "Yearly (Jan 1)" },
            ]} />
          </Field>
          <Field label="Health Connect source" hint="(fills progress automatically)">
            <Select value={healthSource} title="Health Connect source" options={HEALTH_SOURCES} onChange={setHealthSource} />
          </Field>
        </View>
      ) : null}

      <Field label="Frequency">
        <Select value={freq} title="Frequency" options={freqOptions} onChange={setFreq} />
      </Field>

      {freq === "weekly" && !progressOn ? (
        <Field label="Weekly target (days)">
          <NumberInput value={weeklyTarget} onChangeText={setWeeklyTarget} style={{ width: 80 }} />
        </Field>
      ) : null}

      {freq === "specific_days_weekly" ? (
        <Field label="Which days?" error={errors.days}>
          <Chips multiple options={DAYS_OF_WEEK} value={days} onChange={(d) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))} />
        </Field>
      ) : null}

      {freq === "specific_dates_monthly" ? (
        <Field label="Which dates of the month?" error={errors.dates}>
          <Chips
            small
            multiple
            options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            value={dates}
            onChange={(d) => setDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}
          />
        </Field>
      ) : null}

      {freq === "specific_dates_yearly" ? (
        <Field
          label="Which date(s) each year?"
          error={errors.yearly}
          right={<IconButton icon="add-circle-outline" color={c.primary} label="Add another date" onPress={() => setYearly((p) => [...p, { month: "01", day: "1" }])} />}
        >
          <View style={{ gap: 8 }}>
            {yearly.map((entry, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 2 }}>
                  <Select
                    value={entry.month}
                    title="Month"
                    options={MONTHS.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))}
                    onChange={(m) => setYearly((p) => p.map((e, i) => (i === idx ? { ...e, month: m } : e)))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberInput value={entry.day} placeholder="Day" onChangeText={(d) => setYearly((p) => p.map((e, i) => (i === idx ? { ...e, day: d } : e)))} />
                </View>
                {yearly.length > 1 ? <IconButton icon="close" label="Remove date" onPress={() => setYearly((p) => p.filter((_, i) => i !== idx))} /> : null}
              </View>
            ))}
          </View>
        </Field>
      ) : null}

      <TimingField
        useExact={useExact}
        setUseExact={setUseExact}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        exactTime={exactTime}
        setExactTime={setExactTime}
      />

      {!progressOn ? (
        <Field label="Default duration (min)" hint="(optional)">
          <NumberInput value={duration} onChangeText={setDuration} placeholder="e.g. 30" />
        </Field>
      ) : null}

      <Field label="Description" hint="(optional)">
        <Input value={desc} onChangeText={setDesc} placeholder="Any notes…" multiline />
      </Field>

      {groups.length > 0 ? (
        <Field label="Group">
          <Select value={groupId} title="Group" options={groupOptions(groups)} onChange={setGroupId} />
        </Field>
      ) : null}

      <Button title={editing ? "Save changes" : "Add habit"} onPress={save} loading={busy} />
      {editing ? <Button title="Delete habit" variant="danger" onPress={confirmDelete} /> : null}
    </View>
  );
}

export function TimingField(props: {
  useExact: boolean;
  setUseExact: (v: boolean) => void;
  timeOfDay: string;
  setTimeOfDay: (v: string) => void;
  exactTime: string;
  setExactTime: (v: string) => void;
}) {
  return (
    <Field
      label="Timing"
      hint="(optional)"
      right={<Button title={props.useExact ? "Use time of day" : "Use exact time"} variant="ghost" onPress={() => props.setUseExact(!props.useExact)} style={{ paddingVertical: 2, paddingHorizontal: 4 }} />}
    >
      {props.useExact ? (
        <TimeField value={props.exactTime} onChange={props.setExactTime} clearable />
      ) : (
        <Select value={props.timeOfDay} title="Time of day" options={TIME_OF_DAY_OPTIONS} onChange={props.setTimeOfDay} />
      )}
    </Field>
  );
}
