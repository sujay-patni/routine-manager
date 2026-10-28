import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { getSettings, saveSettings, type AppSettings } from "@/lib/services/settings";
import { useLoader } from "@/lib/useLoader";
import { radius, useColors } from "@/lib/theme";
import { toast, toastError } from "@/lib/format";
import { Button, Card, Chips, Field, IconButton, Input, Overline, Select, Txt, type IconName } from "@/components/ui";

const COMMON_TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok",
  "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland", "Pacific/Honolulu",
];

const LINKS: { href: Href; label: string; hint: string; icon: IconName }[] = [
  { href: "/settings/habits", label: "Habits", hint: "Reorder, pause, edit", icon: "checkmark-done-outline" },
  { href: "/settings/groups", label: "Groups", hint: "Colour-code habits and events", icon: "pricetags-outline" },
  { href: "/settings/vacations", label: "Vacations", hint: "Pause habits for a date range", icon: "airplane-outline" },
  { href: "/settings/health", label: "Health Connect", hint: "Steps, sleep, distance, calories", icon: "pulse-outline" },
  { href: "/settings/backup", label: "Backup & restore", hint: "Export, import, move from the web app", icon: "cloud-download-outline" },
];

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <IconButton icon="remove" label="Decrease" onPress={() => onChange(Math.max(min, value - 1))} style={[styles.stepBtn, { borderColor: c.border }]} size={16} />
      <Txt weight="700" style={{ minWidth: 24, textAlign: "center" }}>{value}</Txt>
      <IconButton icon="add" label="Increase" onPress={() => onChange(Math.min(max, value + 1))} style={[styles.stepBtn, { borderColor: c.border }]} size={16} />
    </View>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const { data: settings } = useLoader(getSettings, []);
  // Remount the form whenever stored settings change (e.g. after a restore).
  if (!settings) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  return <SettingsForm key={JSON.stringify(settings)} settings={settings} />;
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStart, setWeekStart] = useState(String(settings.week_start_day));
  const [surfaceDays, setSurfaceDays] = useState(settings.deadline_surface_days);
  const [dayStart, setDayStart] = useState(settings.day_start_hour);
  const [units, setUnits] = useState<string[]>(settings.progress_units);
  const [newUnit, setNewUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzOptions = Array.from(new Set([timezone, deviceTz, ...COMMON_TIMEZONES].filter(Boolean))).map((tz) => ({
    value: tz,
    label: tz === deviceTz ? `${tz} (this phone)` : tz,
  }));

  async function save(nextUnits = units) {
    setSaving(true);
    const r = await saveSettings({
      timezone,
      week_start_day: Number(weekStart),
      deadline_surface_days: surfaceDays,
      day_start_hour: dayStart,
      progress_units: nextUnits,
    });
    setSaving(false);
    if (r.error) toastError("Couldn't save settings", r.error);
    else toast("Settings saved");
  }

  function addUnit() {
    const u = newUnit.trim();
    if (!u || units.includes(u)) return;
    const next = [...units, u];
    setUnits(next);
    setNewUnit("");
    save(next);
  }

  function removeUnit(u: string) {
    const next = units.filter((x) => x !== u);
    setUnits(next);
    save(next);
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40, gap: 22 }}>
      <Text style={{ fontFamily: "serif", fontSize: 30, color: c.foreground }}>Settings</Text>

      <View style={{ gap: 12 }}>
        <Overline>Preferences</Overline>
        <Card style={{ gap: 18 }}>
          <Field label="Timezone">
            <Select value={timezone} title="Timezone" options={tzOptions} onChange={setTimezone} />
          </Field>
          <View style={styles.row}>
            <Txt size={13} weight="600">Week starts on</Txt>
            <Chips options={[{ value: "1", label: "Monday" }, { value: "0", label: "Sunday" }]} value={weekStart} onChange={setWeekStart} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt size={13} weight="600">Show deadlines</Txt>
              <Txt size={12} muted>{surfaceDays} days before the due date</Txt>
            </View>
            <Stepper value={surfaceDays} min={0} max={30} onChange={setSurfaceDays} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt size={13} weight="600">Day starts at</Txt>
              <Txt size={12} muted>{dayStart === 0 ? "Midnight (default)" : `${dayStart}:00 AM — yesterday's habits stay open until then`}</Txt>
            </View>
            <Stepper value={dayStart} min={0} max={11} onChange={setDayStart} />
          </View>
          <Button title="Save preferences" onPress={() => save()} loading={saving} />
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <Overline>Progress units</Overline>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {units.map((u) => (
              <View key={u} style={[styles.unit, { backgroundColor: c.muted }]}>
                <Txt size={13}>{u}</Txt>
                {u !== "mins" && u !== "hrs" ? <IconButton icon="close" size={14} label={`Remove ${u}`} onPress={() => removeUnit(u)} style={{ padding: 0 }} /> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Input value={newUnit} onChangeText={setNewUnit} placeholder="e.g. pages, km, steps" style={{ flex: 1 }} onSubmitEditing={addUnit} />
            <Button title="Add" variant="secondary" onPress={addUnit} />
          </View>
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <Overline>Manage</Overline>
        <Card style={{ padding: 0 }}>
          {LINKS.map((l, i) => (
            <Pressable
              key={l.label}
              onPress={() => router.push(l.href)}
              style={({ pressed }) => [styles.link, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, pressed && { backgroundColor: c.muted }]}
            >
              <Ionicons name={l.icon} size={20} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Txt weight="600">{l.label}</Txt>
                <Txt size={12} muted>{l.hint}</Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      </View>

      <Txt size={12} muted style={{ textAlign: "center" }}>All data is stored on this phone. Use Backup & restore to keep a copy.</Txt>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  stepBtn: { borderWidth: 1, borderRadius: radius.sm, padding: 4 },
  unit: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  link: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
});
