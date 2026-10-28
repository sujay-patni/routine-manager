import { useState } from "react";
import { ScrollView, View } from "react-native";
import { getAllHabits, reorderHabits, updateHabit } from "@/lib/services/habits";
import { getAllGroups } from "@/lib/services/groups";
import { getSettings } from "@/lib/services/settings";
import type { Habit } from "@/lib/types";
import { useLoader } from "@/lib/useLoader";
import { useColors } from "@/lib/theme";
import { fmtClock, toastError } from "@/lib/format";
import { AddItemSheet, EditHabitSheet } from "@/components/ItemSheets";
import { Button, Card, EmptyState, IconButton, Overline, Txt } from "@/components/ui";

const SECTIONS = ["morning", "afternoon", "evening", "night", "all_day"] as const;
type SectionKey = (typeof SECTIONS)[number];
const LABELS: Record<SectionKey, string> = {
  morning: "🌅 Morning", afternoon: "☀️ Afternoon", evening: "🌆 Evening", night: "🌙 Night", all_day: "🗓 Any time",
};

function sectionOf(h: Habit): SectionKey {
  if (h.time_of_day) return h.time_of_day;
  if (h.exact_time) {
    const hr = parseInt(h.exact_time, 10);
    if (hr >= 4 && hr < 12) return "morning";
    if (hr >= 12 && hr < 16) return "afternoon";
    if (hr >= 16 && hr < 20) return "evening";
    return "night";
  }
  return "all_day";
}

const FREQ: Record<Habit["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  specific_days_weekly: "Specific days",
  specific_dates_monthly: "Monthly dates",
  specific_dates_yearly: "Yearly",
};

async function load() {
  const [habits, groups, settings] = await Promise.all([getAllHabits(), getAllGroups(), getSettings()]);
  return { habits, groups, settings };
}

export default function HabitsScreen() {
  const c = useColors();
  const { data } = useLoader(load, []);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [adding, setAdding] = useState(false);
  const habits = data?.habits ?? [];
  const groups = data?.groups ?? [];
  const units = data?.settings.progress_units ?? ["mins", "hrs"];

  const bySection = new Map<SectionKey, Habit[]>(SECTIONS.map((s) => [s, []]));
  for (const h of habits) bySection.get(sectionOf(h))!.push(h);
  for (const list of bySection.values()) list.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));

  async function move(section: SectionKey, index: number, dir: -1 | 1) {
    const ids = bySection.get(section)!.map((h) => h.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const r = await reorderHabits(ids);
    if (r.error) toastError("Couldn't save order", r.error);
  }

  async function toggleActive(h: Habit) {
    const r = await updateHabit(h.id, { is_active: !h.is_active });
    if (r.error) toastError("Couldn't update habit", r.error);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        <Button title="Add habit" icon="add" variant="secondary" onPress={() => setAdding(true)} />
        {data && habits.length === 0 ? <EmptyState emoji="💪" title="No habits yet" body="Add your first habit to start tracking." /> : null}
        {SECTIONS.map((s) => {
          const list = bySection.get(s)!;
          if (list.length === 0) return null;
          return (
            <View key={s} style={{ gap: 8 }}>
              <Overline>{LABELS[s]}</Overline>
              {list.map((h, i) => {
                const group = groups.find((g) => g.id === h.group_id);
                return (
                  <Card key={h.id} onPress={() => setEditing(h)} style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, !h.is_active && { opacity: 0.55 }, group ? { borderLeftWidth: 3, borderLeftColor: group.color } : null]}>
                    <View>
                      <IconButton icon="chevron-up" size={16} label="Move up" onPress={() => move(s, i, -1)} style={{ padding: 2, opacity: i === 0 ? 0.3 : 1 }} />
                      <IconButton icon="chevron-down" size={16} label="Move down" onPress={() => move(s, i, 1)} style={{ padding: 2, opacity: i === list.length - 1 ? 0.3 : 1 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt weight="600" numberOfLines={1}>{h.name}</Txt>
                      <Txt size={12} muted>
                        {FREQ[h.frequency]}
                        {h.exact_time ? ` · ${fmtClock(h.exact_time)}` : ""}
                        {h.progress_metric ? ` · ${h.progress_target} ${h.progress_metric}` : ""}
                        {h.health_source ? " · Health Connect" : ""}
                        {!h.is_active ? " · paused" : ""}
                      </Txt>
                    </View>
                    <Button title={h.is_active ? "Pause" : "Resume"} variant={h.is_active ? "secondary" : "primary"} onPress={() => toggleActive(h)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
                  </Card>
                );
              })}
            </View>
          );
        })}
        <Txt size={12} muted style={{ color: c.mutedForeground }}>Paused habits stay out of Today but keep their history.</Txt>
      </ScrollView>
      <AddItemSheet open={adding} onClose={() => setAdding(false)} defaultTab="habit" groups={groups} progressUnits={units} />
      <EditHabitSheet habit={editing} onClose={() => setEditing(null)} groups={groups} progressUnits={units} />
    </View>
  );
}
