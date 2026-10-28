import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { getAllEventsForCalendar } from "@/lib/services/events";
import { getAllGroups } from "@/lib/services/groups";
import { getSettings } from "@/lib/services/settings";
import { parseZonedOrLocal } from "@/lib/habit-logic";
import type { AppEvent } from "@/lib/types";
import { useLoader } from "@/lib/useLoader";
import { radius, useColors } from "@/lib/theme";
import { fmtClock } from "@/lib/format";
import { AddItemSheet, EditEventSheet } from "@/components/ItemSheets";
import { Chips, IconButton, Overline, Txt } from "@/components/ui";

type View_ = "month" | "schedule";
type Range = "week" | "month" | "quarter" | "year";

const TYPE_COLORS: Record<AppEvent["event_type"], string> = { timed: "#3b82f6", all_day: "#10b981", deadline: "#f97316" };
const TYPE_ICON: Record<AppEvent["event_type"], string> = { timed: "📅", all_day: "📋", deadline: "⏰" };

function eventDate(e: AppEvent, tz: string): string | null {
  if (e.event_type === "timed" && e.start_time) return format(parseZonedOrLocal(e.start_time, tz), "yyyy-MM-dd");
  return e.due_date;
}

function eventTime(e: AppEvent, tz: string): string {
  if (e.event_type === "timed" && e.start_time) {
    const d = parseZonedOrLocal(e.start_time, tz);
    return fmtClock(`${d.getHours()}:${d.getMinutes()}`);
  }
  if (e.due_time) return fmtClock(e.due_time);
  if (e.time_of_day) return { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" }[e.time_of_day] ?? "";
  return e.event_type === "deadline" ? "Deadline" : "All day";
}

async function load() {
  const [events, groups, settings] = await Promise.all([getAllEventsForCalendar(), getAllGroups(), getSettings()]);
  return { events, groups, settings };
}

export default function CalendarScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useLoader(load, []);
  const [view, setView] = useState<View_>("month");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(format(new Date(), "yyyy-MM-dd"));
  const [range, setRange] = useState<Range>("quarter");
  const [filters, setFilters] = useState<string[]>([]);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const tz = data?.settings.timezone ?? "UTC";
  const weekStartsOn = (data?.settings.week_start_day === 0 ? 0 : 1) as 0 | 1;
  const groups = data?.groups ?? [];

  const byDate = useMemo(() => {
    const map = new Map<string, AppEvent[]>();
    for (const e of data?.events ?? []) {
      if (filters.length && !filters.includes(e.group_id ?? "unassigned")) continue;
      const d = eventDate(e, tz);
      if (!d) continue;
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return map;
  }, [data, filters, tz]);

  const gridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const scheduleEnd = (() => {
    const t = new Date();
    if (range === "week") return format(endOfWeek(t, { weekStartsOn }), "yyyy-MM-dd");
    if (range === "month") return format(endOfMonth(t), "yyyy-MM-dd");
    if (range === "year") return `${t.getFullYear()}-12-31`;
    return format(endOfQuarter(t), "yyyy-MM-dd");
  })();
  const scheduleDates = [...byDate.keys()].filter((d) => d >= todayStr && d <= scheduleEnd).sort();

  function EventRow({ e }: { e: AppEvent }) {
    const dotColor = groups.find((g) => g.id === e.group_id)?.color ?? TYPE_COLORS[e.event_type];
    return (
      <Pressable
        onPress={() => setEditing(e)}
        style={({ pressed }) => [styles.eventRow, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text>{TYPE_ICON[e.event_type]}</Text>
        <View style={{ flex: 1 }}>
          <Txt weight="500" numberOfLines={1} style={e.is_completed && { textDecorationLine: "line-through", color: c.mutedForeground }}>{e.title}</Txt>
          <Txt size={12} muted>{eventTime(e, tz)}</Txt>
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      </Pressable>
    );
  }

  const selectedEvents = byDate.get(selected) ?? [];
  const weekdayLabels = gridDays.slice(0, 7).map((d) => format(d, "EEEEE"));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: c.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flex: 1, fontFamily: "serif", fontSize: 30, color: c.foreground }}>
            {view === "month" ? format(month, "MMMM yyyy") : "Schedule"}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {view === "month" ? (
              <>
                <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} />
                <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth((m) => addMonths(m, 1))} />
              </>
            ) : null}
            <IconButton icon="add-circle" color={c.primary} size={28} label="Add" onPress={() => setAddOpen(true)} />
          </View>
        </View>
        <Chips options={[{ value: "month", label: "Month" }, { value: "schedule", label: "Schedule" }]} value={view} onChange={setView} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {groups.length > 0 ? (
          <Chips
            multiple
            options={[...groups.map((g) => ({ value: g.id, label: g.name, color: g.color })), { value: "unassigned", label: "No group" }]}
            value={filters}
            onChange={(id) => setFilters((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
          />
        ) : null}

        {view === "month" ? (
          <>
            <View>
              <View style={{ flexDirection: "row" }}>
                {weekdayLabels.map((l, i) => (
                  <Txt key={i} size={12} muted style={{ flex: 1, textAlign: "center" }}>{l}</Txt>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
                {gridDays.map((d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  const evs = byDate.get(ds) ?? [];
                  const isSel = ds === selected;
                  const isToday = ds === todayStr;
                  return (
                    <Pressable
                      key={ds}
                      onPress={() => setSelected(ds)}
                      accessibilityLabel={`${format(d, "EEEE MMMM d")}, ${evs.length} items`}
                      style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                    >
                      <View style={[styles.dayCell, { backgroundColor: isSel ? c.primary : isToday ? c.accent : "transparent" }]}>
                        <Txt
                          size={14}
                          weight={isToday ? "700" : "400"}
                          style={{ color: isSel ? c.primaryForeground : isSameMonth(d, month) ? c.foreground : c.mutedForeground, opacity: isSameMonth(d, month) ? 1 : 0.5 }}
                        >
                          {format(d, "d")}
                        </Txt>
                        <View style={{ flexDirection: "row", gap: 2, height: 6 }}>
                          {evs.slice(0, 3).map((e) => (
                            <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? c.primaryForeground : groups.find((g) => g.id === e.group_id)?.color ?? TYPE_COLORS[e.event_type] }} />
                          ))}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Overline>{format(parseISO(selected), "EEEE, MMMM d")}</Overline>
              {selectedEvents.length === 0 ? <Txt muted>Nothing scheduled.</Txt> : selectedEvents.map((e) => <EventRow key={e.id} e={e} />)}
            </View>
          </>
        ) : (
          <>
            <Chips
              options={[
                { value: "week", label: "This week" },
                { value: "month", label: "This month" },
                { value: "quarter", label: "This quarter" },
                { value: "year", label: "This year" },
              ]}
              value={range}
              onChange={setRange}
            />
            {scheduleDates.length === 0 ? <Txt muted>Nothing coming up.</Txt> : null}
            {scheduleDates.map((ds) => (
              <View key={ds} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text style={{ fontFamily: "serif", fontSize: 18, color: c.foreground }}>{format(parseISO(ds), "EEEE")}</Text>
                  <Overline style={{ fontSize: 10 }}>{format(parseISO(ds), "MMMM d")}</Overline>
                </View>
                {(byDate.get(ds) ?? []).map((e) => <EventRow key={e.id} e={e} />)}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <AddItemSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultTab="timed"
        defaultDate={selected}
        groups={groups}
        progressUnits={data?.settings.progress_units ?? ["mins", "hrs"]}
      />
      <EditEventSheet event={editing} onClose={() => setEditing(null)} groups={groups} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dayCell: { flex: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 3 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
