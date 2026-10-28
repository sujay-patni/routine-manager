import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { endVacationNow, getTemplates, getVacations, removeVacation, saveVacation } from "@/lib/services/vacations";
import { getAllHabits } from "@/lib/services/habits";
import { getAllGroups } from "@/lib/services/groups";
import { getSettings } from "@/lib/services/settings";
import { formatDateForDB } from "@/lib/habit-logic";
import type { Group, Habit, Vacation } from "@/lib/types";
import { useLoader } from "@/lib/useLoader";
import { toast, toastError } from "@/lib/format";
import { Button, Card, Chips, DateField, EmptyState, Field, Input, Overline, Sheet, ToggleRow, Txt } from "@/components/ui";

type Mode = "instance" | "template";

async function load() {
  const [vacations, templates, habits, groups, settings] = await Promise.all([getVacations(), getTemplates(), getAllHabits(), getAllGroups(), getSettings()]);
  const today = formatDateForDB(toZonedTime(new Date(), settings.timezone));
  return { vacations, templates, habits, groups, today };
}

function fmtRange(start: string | null, end: string | null) {
  if (!start || !end) return "";
  const s = parseISO(start);
  const e = parseISO(end);
  return `${format(s, s.getFullYear() === e.getFullYear() ? "MMM d" : "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

function pausedCount(v: Pick<Vacation, "habit_ids" | "group_ids">, habits: Habit[]) {
  const ids = new Set(v.habit_ids);
  const gs = new Set(v.group_ids);
  for (const h of habits) if (h.group_id && gs.has(h.group_id)) ids.add(h.id);
  return ids.size;
}

const ERRORS: Record<string, string> = {
  name_required: "Name is required",
  dates_required: "Pick a start and end date",
  invalid_range: "End date must be on or after the start date",
};

function Editor({ mode, vacation, preset, habits, groups, today, onClose }: {
  mode: Mode;
  vacation: Vacation | null;
  preset: Vacation | null;
  habits: Habit[];
  groups: Group[];
  today: string;
  onClose: () => void;
}) {
  const source = vacation ?? preset;
  const [name, setName] = useState(source?.name ?? "");
  const [start, setStart] = useState(vacation?.start_date ?? today);
  const [end, setEnd] = useState(vacation?.end_date ?? today);
  const [habitIds, setHabitIds] = useState<string[]>(source?.habit_ids ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(source?.group_ids ?? []);
  const [note, setNote] = useState(source?.note ?? "");
  const [savePreset, setSavePreset] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save() {
    if (habitIds.length === 0 && groupIds.length === 0) return toastError("Select at least one habit or group to pause");
    setBusy(true);
    const isTemplate = mode === "template";
    const res = await saveVacation({
      id: vacation?.id,
      name,
      is_template: isTemplate,
      start_date: isTemplate ? null : start,
      end_date: isTemplate ? null : end,
      habit_ids: habitIds,
      group_ids: groupIds,
      note: note.trim() || null,
    });
    if (!res.error && !isTemplate && !vacation && savePreset) {
      await saveVacation({ name, is_template: true, habit_ids: habitIds, group_ids: groupIds, note: note.trim() || null });
    }
    setBusy(false);
    if (res.error) return toastError(ERRORS[res.error] ?? res.error);
    toast("Saved");
    onClose();
  }

  return (
    <>
      <Field label="Name"><Input value={name} onChangeText={setName} placeholder="e.g. Goa trip" /></Field>
      {mode === "instance" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Start date"><DateField value={start} onChange={setStart} /></Field></View>
          <View style={{ flex: 1 }}><Field label="End date"><DateField value={end} onChange={setEnd} /></Field></View>
        </View>
      ) : null}
      <Txt size={12} muted>Pausing {pausedCount({ habit_ids: habitIds, group_ids: groupIds }, habits)} habit(s)</Txt>
      {groups.length > 0 ? (
        <Field label="Pause whole groups">
          <Chips multiple options={groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} value={groupIds} onChange={(id) => setGroupIds((p) => toggle(p, id))} />
        </Field>
      ) : null}
      <Field label="Pause individual habits">
        <Chips multiple options={habits.filter((h) => h.is_active).map((h) => ({ value: h.id, label: h.name }))} value={habitIds} onChange={(id) => setHabitIds((p) => toggle(p, id))} />
      </Field>
      <Field label="Note" hint="(optional)"><Input value={note} onChangeText={setNote} multiline /></Field>
      {mode === "instance" && !vacation ? <ToggleRow label="Also save as a preset" value={savePreset} onChange={setSavePreset} /> : null}
      <Button title="Save" onPress={save} loading={busy} />
    </>
  );
}

export default function VacationsScreen() {
  const { data } = useLoader(load, []);
  const [editor, setEditor] = useState<{ mode: Mode; vacation: Vacation | null; preset: Vacation | null } | null>(null);
  const today = data?.today ?? formatDateForDB(new Date());
  const vacations = data?.vacations ?? [];
  const current = vacations.filter((v) => v.start_date && v.end_date && v.start_date <= today && v.end_date >= today);
  const upcoming = vacations.filter((v) => v.start_date && v.start_date > today).sort((a, b) => a.start_date!.localeCompare(b.start_date!));
  const past = vacations.filter((v) => v.end_date && v.end_date < today);

  function actions(v: Vacation, isCurrent: boolean) {
    Alert.alert(v.name, fmtRange(v.start_date, v.end_date), [
      { text: "Edit", onPress: () => setEditor({ mode: v.is_template ? "template" : "instance", vacation: v, preset: null }) },
      ...(isCurrent
        ? [{ text: "End now", onPress: async () => {
            const r = await endVacationNow(v.id);
            if (r.error) toastError("Couldn't end vacation", r.error);
          } }]
        : []),
      { text: "Delete", style: "destructive" as const, onPress: async () => {
          const r = await removeVacation(v.id);
          if (r.error) toastError("Couldn't delete", r.error);
        } },
    ]);
  }

  function VacationCard({ v, isCurrent }: { v: Vacation; isCurrent?: boolean }) {
    return (
      <Card onPress={() => actions(v, !!isCurrent)} style={{ gap: 2 }}>
        <Txt weight="600">{v.name}</Txt>
        <Txt size={12} muted>
          {v.is_template ? "Preset" : fmtRange(v.start_date, v.end_date)} · pauses {pausedCount(v, data?.habits ?? [])} habit(s)
        </Txt>
      </Card>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        <Button title="New vacation" icon="add" variant="secondary" onPress={() => setEditor({ mode: "instance", vacation: null, preset: null })} />
        {data && vacations.length === 0 && data.templates.length === 0 ? (
          <EmptyState emoji="🏝️" title="No vacations" body="Pause habits for a date range so missed days don't count against you." />
        ) : null}
        {[
          { title: "Happening now", list: current, isCurrent: true },
          { title: "Upcoming", list: upcoming },
          { title: "Past", list: past },
        ].map((s) =>
          s.list.length ? (
            <View key={s.title} style={{ gap: 8 }}>
              <Overline>{s.title}</Overline>
              {s.list.map((v) => <VacationCard key={v.id} v={v} isCurrent={s.isCurrent} />)}
            </View>
          ) : null
        )}
        <View style={{ gap: 8 }}>
          <Overline>Presets</Overline>
          {data?.templates.map((t) => (
            <Card key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt weight="600">{t.name}</Txt>
                <Txt size={12} muted>Pauses {pausedCount(t, data.habits)} habit(s)</Txt>
              </View>
              <Button title="Use" variant="secondary" onPress={() => setEditor({ mode: "instance", vacation: null, preset: t })} style={{ paddingVertical: 6 }} />
              <Button title="Edit" variant="ghost" onPress={() => actions(t, false)} style={{ paddingVertical: 6 }} />
            </Card>
          ))}
          <Button title="New preset" variant="ghost" icon="add" onPress={() => setEditor({ mode: "template", vacation: null, preset: null })} />
        </View>
      </ScrollView>

      <Sheet
        open={editor != null}
        onClose={() => setEditor(null)}
        title={editor?.mode === "template" ? (editor.vacation ? "Edit preset" : "New preset") : editor?.vacation ? "Edit vacation" : "New vacation"}
      >
        {editor && data ? (
          <Editor
            key={`${editor.mode}-${editor.vacation?.id ?? editor.preset?.id ?? "new"}`}
            {...editor}
            habits={data.habits}
            groups={data.groups}
            today={today}
            onClose={() => setEditor(null)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
