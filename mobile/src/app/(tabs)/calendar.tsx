import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isSameYear,
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
import { Button, Chips, IconButton, Overline, Txt } from "@/components/ui";
import TimeGrid, { TYPE_COLORS } from "@/components/TimeGrid";
import YearGrid from "@/components/YearGrid";

type CalView = "day" | "week" | "month" | "year" | "schedule";
type Range = "today" | "week" | "month" | "quarter" | "year";

const VIEW_OPTIONS: { value: CalView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "schedule", label: "Schedule" },
];
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
  const [view, setView] = useState<CalView>("month");
  // The day each view is centred on (like the web app's currentDate).
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(format(new Date(), "yyyy-MM-dd"));
  const [range, setRange] = useState<Range>("quarter");
  const [filters, setFilters] = useState<string[]>([]);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [addDate, setAddDate] = useState<string | null>(null);

  const tz = data?.settings.timezone ?? "UTC";
  const weekStartsOn = (data?.settings.week_start_day === 0 ? 0 : 1) as 0 | 1;
  const groups = data?.groups ?? [];
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const month = startOfMonth(anchor);

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

  function shift(dir: 1 | -1) {
    const next =
      view === "day" ? addDays(anchor, dir)
      : view === "week" ? addWeeks(anchor, dir)
      : view === "year" ? addYears(anchor, dir)
      : addMonths(anchor, dir);
    setAnchor(next);
    if (view === "day" || view === "week") setSelected(format(next, "yyyy-MM-dd"));
  }

  const onCurrent =
    view === "day" ? isSameDay(anchor, today)
    : view === "week" ? isSameWeek(anchor, today, { weekStartsOn })
    : view === "month" ? isSameMonth(anchor, today) && selected === todayStr
    : view === "year" ? isSameYear(anchor, today)
    : true;

  const title =
    view === "day" ? format(anchor, "EEE, MMM d")
    : view === "week" || view === "month" ? format(anchor, "MMMM yyyy")
    : view === "year" ? format(anchor, "yyyy")
    : "Schedule";

  const gridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
  const weekDays = eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn }), end: endOfWeek(anchor, { weekStartsOn }) });

  const scheduleEnd = (() => {
    if (range === "today") return todayStr;
    if (range === "week") return format(endOfWeek(today, { weekStartsOn }), "yyyy-MM-dd");
    if (range === "month") return format(endOfMonth(today), "yyyy-MM-dd");
    if (range === "year") return `${today.getFullYear()}-12-31`;
    return format(endOfQuarter(today), "yyyy-MM-dd");
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

  const filterChips = groups.length > 0 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
      <Chips
        multiple
        options={[...groups.map((g) => ({ value: g.id, label: g.name, color: g.color })), { value: "unassigned", label: "No group" }]}
        value={filters}
        onChange={(id) => setFilters((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
      />
    </ScrollView>
  ) : null;

  const selectedEvents = byDate.get(selected) ?? [];
  const weekdayLabels = gridDays.slice(0, 7).map((d) => format(d, "EEEEE"));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: c.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flex: 1, fontFamily: "serif", fontSize: 30, color: c.foreground }}>
            {title}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {view !== "schedule" ? (
              <>
                <IconButton icon="chevron-back" label={`Previous ${view}`} onPress={() => shift(-1)} />
                <IconButton icon="chevron-forward" label={`Next ${view}`} onPress={() => shift(1)} />
              </>
            ) : null}
            <IconButton icon="add-circle" color={c.primary} size={28} label="Add" onPress={() => setAddDate(view === "day" ? format(anchor, "yyyy-MM-dd") : selected)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
          <Chips small options={VIEW_OPTIONS} value={view} onChange={setView} />
          {!onCurrent ? (
            <Button
              title="Today"
              variant="ghost"
              onPress={() => {
                setAnchor(new Date());
                setSelected(todayStr);
              }}
              style={{ paddingVertical: 6, paddingHorizontal: 8 }}
            />
          ) : null}
        </View>
        {filterChips}
      </View>

      {view === "day" || view === "week" ? (
        <TimeGrid
          days={view === "day" ? [anchor] : weekDays}
          eventsByDate={byDate}
          groups={groups}
          timezone={tz}
          onOpenEvent={setEditing}
          onAddOnDay={(ds) => setAddDate(ds)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
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
          ) : view === "year" ? (
            <YearGrid
              year={anchor.getFullYear()}
              weekStartsOn={weekStartsOn}
              eventsByDate={byDate}
              onOpenMonth={(m) => {
                setAnchor(m);
                setView("month");
              }}
            />
          ) : (
            <>
              <Chips
                options={[
                  { value: "today", label: "Today" },
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
      )}

      <AddItemSheet
        open={addDate != null}
        onClose={() => setAddDate(null)}
        defaultTab="timed"
        defaultDate={addDate ?? selected}
        groups={groups}
        progressUnits={data?.settings.progress_units ?? ["mins", "hrs"]}
      />
      <EditEventSheet event={editing} onClose={() => setEditing(null)} groups={groups} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dayCell: { flex: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 3 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
