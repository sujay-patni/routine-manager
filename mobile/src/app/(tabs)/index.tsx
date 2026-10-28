import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { addDays, eachDayOfInterval, format, isBefore, parseISO, startOfDay, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Svg, { Circle } from "react-native-svg";
import { getDayLog, getTodayHabits, skipHabit, unskipHabit, type DayLogResult } from "@/lib/services/habits";
import { getTodayEvents, skipEvent, unskipEvent, type TodayEvent } from "@/lib/services/events";
import { getAllGroups } from "@/lib/services/groups";
import { getSettings } from "@/lib/services/settings";
import { isHabitScheduledForDay, type ProcessedHabit } from "@/lib/habit-logic";
import { syncHealth } from "@/lib/health/sync";
import { useLoader } from "@/lib/useLoader";
import { radius, useColors } from "@/lib/theme";
import { fmtMins, toastError } from "@/lib/format";
import HabitCard from "@/components/HabitCard";
import EventCard from "@/components/EventCard";
import { AddItemSheet, EditEventSheet, EditHabitSheet, type AddTab } from "@/components/ItemSheets";
import { Accordion, Banner, Chips, EmptyState, IconButton, Overline, ProgressBar, Sheet, Txt, openDatePicker } from "@/components/ui";

type TimeKey = "morning" | "afternoon" | "evening" | "night";

const TIME_SECTIONS: Record<TimeKey, { label: string; icon: string; range: string; capacityMins: number }> = {
  morning: { label: "Morning", icon: "🌅", range: "4 AM – 12 PM", capacityMins: 8 * 60 },
  afternoon: { label: "Afternoon", icon: "☀️", range: "12 PM – 4 PM", capacityMins: 4 * 60 },
  evening: { label: "Evening", icon: "🌆", range: "4 PM – 8 PM", capacityMins: 4 * 60 },
  night: { label: "Night", icon: "🌙", range: "8 PM – 4 AM", capacityMins: 8 * 60 },
};
const ALL_KEYS: TimeKey[] = ["morning", "afternoon", "evening", "night"];
const WEEK_SECTIONS = ["morning", "afternoon", "evening", "night", "all_day"] as const;
const WEEK_SECTION_LABELS: Record<(typeof WEEK_SECTIONS)[number], string> = {
  morning: "🌅 Morning", afternoon: "☀️ Afternoon", evening: "🌆 Evening", night: "🌙 Night", all_day: "🗓 All Day",
};
const FAB_OPTIONS: { tab: AddTab; label: string; icon: string }[] = [
  { tab: "habit", label: "Habit", icon: "💪" },
  { tab: "timed", label: "Event", icon: "📅" },
  { tab: "all_day", label: "Task", icon: "📋" },
  { tab: "deadline", label: "Deadline", icon: "⏰" },
];

function hourToSection(h: number): TimeKey {
  if (h >= 4 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 20) return "evening";
  return "night";
}
function habitSection(h: ProcessedHabit): TimeKey | null {
  if (h.time_of_day) return h.time_of_day as TimeKey;
  if (h.exact_time) return hourToSection(parseInt(h.exact_time, 10));
  return null;
}
function eventSection(e: TodayEvent): TimeKey | null {
  if (e.event_type === "timed" && e.start_time) return hourToSection(new Date(e.start_time).getHours());
  if (e.time_of_day) return e.time_of_day as TimeKey;
  if (e.due_time) return hourToSection(parseInt(e.due_time, 10));
  return null;
}
function habitMinutes(h: ProcessedHabit): number {
  if (!h.exact_time) return -1;
  const [hr, m] = h.exact_time.split(":").map(Number);
  return hr * 60 + m;
}
function eventMinutes(e: TodayEvent): number {
  if (e.event_type === "timed" && e.start_time) {
    const d = new Date(e.start_time);
    return d.getHours() * 60 + d.getMinutes();
  }
  if (e.due_time) {
    const [h, m] = e.due_time.split(":").map(Number);
    return h * 60 + m;
  }
  return -1;
}

type Entry =
  | { kind: "habit"; item: ProcessedHabit; sortKey: number; done: boolean; timed: boolean }
  | { kind: "event"; item: TodayEvent; sortKey: number; done: boolean; timed: boolean };
type EntryFilter = "pending" | "completed" | "skipped";

async function loadToday(dateParam: string | undefined) {
  const [habitData, events, groups, settings] = await Promise.all([
    getTodayHabits(dateParam),
    getTodayEvents(dateParam),
    getAllGroups(),
    getSettings(),
  ]);
  return { ...habitData, events, groups, settings };
}

export default function TodayScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [dateParam, setDateParam] = useState<string | undefined>(undefined);
  const { data, reload } = useLoader(() => loadToday(dateParam), [dateParam]);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddTab | null>(null);
  const [editHabit, setEditHabit] = useState<ProcessedHabit | null>(null);
  const [editEvent, setEditEvent] = useState<TodayEvent | null>(null);
  const [dayLog, setDayLog] = useState<DayLogResult | null>(null);
  const [dayLogOpen, setDayLogOpen] = useState(false);

  const habits = data?.habits ?? [];
  const events = data?.events ?? [];
  const groups = data?.groups ?? [];
  const dateStr = data?.today ?? format(new Date(), "yyyy-MM-dd");
  const timezone = data?.timezone ?? "UTC";
  const isLateNight = !!data?.isLateNight;

  const available = (() => {
    const ids = new Set<string>();
    let unassigned = false;
    for (const x of [...habits, ...events]) {
      if (x.group_id) ids.add(x.group_id);
      else unassigned = true;
    }
    return { groups: groups.filter((g) => ids.has(g.id)), unassigned, ids: new Set([...ids, ...(unassigned ? ["unassigned"] : [])]) };
  })();
  const activeFilters = filters.filter((f) => available.ids.has(f));
  const inFilter = (groupId: string | null) =>
    activeFilters.length === 0 || activeFilters.includes(groupId ?? "unassigned");

  const fHabits = habits.filter((h) => inFilter(h.group_id));
  const fEvents = events.filter((e) => inFilter(e.group_id));
  const skippedEvents = fEvents.filter((e) => e.is_skipped);
  const visibleEvents = fEvents.filter((e) => !e.is_skipped);
  const skippedHabits = fHabits.filter((h) => h.is_skipped);
  const visibleHabits = fHabits.filter((h) => !h.is_skipped && h.show && h.state !== "satisfied");
  const satisfiedHabits = fHabits.filter((h) => !h.is_skipped && h.state === "satisfied");

  const doneCount = fHabits.filter((h) => !h.is_skipped && h.completed_today > 0).length + visibleEvents.filter((e) => e.is_completed).length;
  const totalCount = fHabits.length + visibleEvents.length;

  // Relative label uses "now" in the user's timezone, like the web page.
  const nowInTz = toZonedTime(new Date(), timezone);
  const nowStr = format(nowInTz, "yyyy-MM-dd");
  const isToday = isLateNight || dateStr === nowStr;
  const relativeLabel = isToday
    ? "Today"
    : dateStr === format(addDays(nowInTz, 1), "yyyy-MM-dd")
      ? "Tomorrow"
      : dateStr === format(subDays(nowInTz, 1), "yyyy-MM-dd")
        ? "Yesterday"
        : format(parseISO(dateStr), "EEEE, MMM d");

  function goTo(newDate: string) {
    setDateParam(newDate === nowStr && !isLateNight ? undefined : newDate);
  }
  function shift(days: number) {
    goTo(format(addDays(parseISO(dateStr), days), "yyyy-MM-dd"));
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await syncHealth();
    } catch (e) {
      toastError("Health sync failed", e);
    }
    await reload();
    setRefreshing(false);
  }

  async function handleHabitSkip(h: ProcessedHabit) {
    const r = await skipHabit({
      habitId: h.id,
      habitName: h.name,
      frequency: h.frequency,
      date: dateStr,
      weekStart: data!.weekStart,
      weekEnd: data!.weekEnd,
      weeklyTarget: h.weekly_target,
      completionsThisWeek: h.completions_this_week,
    });
    if (r.error) toastError("Couldn't skip habit", r.error);
    else setSkippedOpen(true);
  }
  async function handleHabitUnskip(h: ProcessedHabit) {
    if (!h.skip_id) return;
    const r = await unskipHabit(h.skip_id);
    if (r.error) toastError("Couldn't unskip habit", r.error);
  }
  async function handleEventSkip(e: TodayEvent) {
    const r = await skipEvent({ eventId: e.id, eventTitle: e.title, date: dateStr });
    if (r.error) toastError("Couldn't skip", r.error);
    else setSkippedOpen(true);
  }
  async function handleEventUnskip(e: TodayEvent) {
    if (!e.skip_id) return;
    const r = await unskipEvent(e.skip_id);
    if (r.error) toastError("Couldn't unskip", r.error);
  }

  async function openDayLog() {
    setDayLogOpen(true);
    setDayLog(null);
    try {
      setDayLog(await getDayLog(dateStr));
    } catch (e) {
      toastError("Couldn't load day log", e);
    }
  }

  // ── Bucket into time sections ──
  const habitsBySection = new Map<TimeKey, ProcessedHabit[]>();
  const allDayHabits: ProcessedHabit[] = [];
  for (const h of visibleHabits) {
    const s = habitSection(h);
    if (s) habitsBySection.set(s, [...(habitsBySection.get(s) ?? []), h]);
    else allDayHabits.push(h);
  }
  const eventsBySection = new Map<TimeKey, TodayEvent[]>();
  const allDayEvents: TodayEvent[] = [];
  for (const e of visibleEvents) {
    const s = eventSection(e);
    if (s) eventsBySection.set(s, [...(eventsBySection.get(s) ?? []), e]);
    else allDayEvents.push(e);
  }

  function applyFilter(all: Entry[], filter: EntryFilter) {
    return all.filter((e) => (filter === "pending" ? !e.done : filter === "completed" ? e.done : true));
  }
  function buildEntries(key: TimeKey, filter: EntryFilter): Entry[] {
    const sh = filter === "skipped" ? skippedHabits.filter((h) => habitSection(h) === key) : habitsBySection.get(key) ?? [];
    const se = filter === "skipped" ? skippedEvents.filter((e) => eventSection(e) === key) : eventsBySection.get(key) ?? [];
    const all: Entry[] = [
      ...sh.map((h) => ({ kind: "habit" as const, item: h, sortKey: h.exact_time ? habitMinutes(h) : h.sort_order ?? 9999, done: h.completed_today > 0, timed: !!h.exact_time })),
      ...se.map((e) => {
        const m = eventMinutes(e);
        return { kind: "event" as const, item: e, sortKey: m >= 0 ? m : 9999, done: e.is_completed, timed: m >= 0 };
      }),
    ];
    return applyFilter(all, filter).sort((a, b) => (a.timed ? 1 : 0) - (b.timed ? 1 : 0) || a.sortKey - b.sortKey);
  }
  function buildAllDay(filter: EntryFilter): Entry[] {
    const hs = filter === "skipped" ? skippedHabits.filter((h) => habitSection(h) == null) : allDayHabits;
    const es = filter === "skipped" ? skippedEvents.filter((e) => eventSection(e) == null) : allDayEvents;
    const all: Entry[] = [
      ...hs.map((h) => ({ kind: "habit" as const, item: h, sortKey: h.sort_order ?? 9999, done: h.completed_today > 0, timed: false })),
      ...es.map((e) => ({ kind: "event" as const, item: e, sortKey: 9999, done: e.is_completed, timed: false })),
    ];
    return applyFilter(all, filter).sort((a, b) => a.sortKey - b.sortKey);
  }
  const plannedFor = (hs: ProcessedHabit[], es: TodayEvent[]) =>
    hs.reduce((s, h) => s + (h.duration_minutes ?? 0), 0) + es.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  function renderEntries(entries: Entry[]) {
    return entries.map((entry) =>
      entry.kind === "habit" ? (
        <HabitCard
          key={entry.item.id}
          habit={entry.item}
          today={dateStr}
          groups={groups}
          onSkip={() => handleHabitSkip(entry.item)}
          onUnskip={() => handleHabitUnskip(entry.item)}
          onEdit={() => setEditHabit(entry.item)}
        />
      ) : (
        <EventCard
          key={entry.item.id}
          event={entry.item}
          groups={groups}
          onSkip={() => handleEventSkip(entry.item)}
          onUnskip={() => handleEventUnskip(entry.item)}
          onEdit={() => setEditEvent(entry.item)}
        />
      )
    );
  }

  const currentKey = hourToSection(new Date().getHours());
  const currentIdx = ALL_KEYS.indexOf(currentKey);
  const upcomingKeys = ALL_KEYS.slice(currentIdx);
  const pastKeys = ALL_KEYS.slice(0, currentIdx);

  function renderTimeSection(key: TimeKey, filter: EntryFilter) {
    const entries = buildEntries(key, filter);
    if (entries.length === 0) return null;
    const sec = TIME_SECTIONS[key];
    const planned = plannedFor(habitsBySection.get(key) ?? [], eventsBySection.get(key) ?? []);
    const dot = filter === "pending" && key === currentKey ? "● " : "";
    const right = filter === "pending" && planned > 0 ? `${fmtMins(planned)} / ${fmtMins(sec.capacityMins)} · ${sec.range}` : sec.range;
    return (
      <View key={`${key}-${filter}`}>
        <SectionHeader left={`${dot}${sec.icon} ${sec.label}`} right={right} faded={filter === "completed"} />
        <View style={{ gap: 8 }}>{renderEntries(entries)}</View>
      </View>
    );
  }
  function renderAllDay(filter: EntryFilter) {
    const entries = buildAllDay(filter);
    if (entries.length === 0) return null;
    const planned = plannedFor(allDayHabits, allDayEvents);
    return (
      <View key={`allday-${filter}`}>
        <SectionHeader left="🗓 All Day" right={filter === "pending" && planned > 0 ? `${fmtMins(planned)} planned` : undefined} faded={filter === "completed"} />
        <View style={{ gap: 8 }}>{renderEntries(entries)}</View>
      </View>
    );
  }

  const hasCompleted = ALL_KEYS.some((k) => buildEntries(k, "completed").length > 0) || buildAllDay("completed").length > 0 || satisfiedHabits.length > 0;
  const hasSkipped = ALL_KEYS.some((k) => buildEntries(k, "skipped").length > 0) || buildAllDay("skipped").length > 0;

  const plannedMins = habits.filter((h) => h.show && !h.is_skipped).reduce((s, h) => s + (h.duration_minutes ?? 0), 0) + visibleEvents.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  // This Week grid
  const weekDays = data ? eachDayOfInterval({ start: parseISO(data.weekStart), end: parseISO(data.weekEnd) }) : [];
  const weekHabits = fHabits
    .filter((h) => h.is_active && ["daily", "weekly", "specific_days_weekly"].includes(h.frequency) && !(h.progress_metric && h.progress_period !== "daily"))
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  const parsedDate = parseISO(dateStr);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: c.border, backgroundColor: c.background }]}>
        <View style={{ flex: 1 }}>
          <Overline>{relativeLabel}</Overline>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: "serif", fontSize: 38, color: c.foreground, lineHeight: 42 }}>{format(parsedDate, "EEEE")},</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 26, color: c.mutedForeground }}>{format(parsedDate, "MMMM d")}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="chevron-back" label="Previous day" onPress={() => shift(-1)} />
            <IconButton icon="calendar-outline" label="Pick a date" onPress={() => openDatePicker(dateStr, goTo)} />
            <IconButton icon="chevron-forward" label="Next day" onPress={() => shift(1)} />
          </View>
          <ProgressRing done={doneCount} total={totalCount} />
          {!isToday ? (
            <Pressable onPress={() => setDateParam(undefined)} hitSlop={8}>
              <Txt size={12} weight="600" style={{ color: c.primary }}>Go to today</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} />}
      >
        {available.groups.length > 0 ? (
          <Chips
            multiple
            options={[
              ...available.groups.map((g) => ({ value: g.id, label: g.name, color: g.color })),
              ...(available.unassigned ? [{ value: "unassigned", label: "No group" }] : []),
            ]}
            value={activeFilters}
            onChange={(id) => setFilters((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
          />
        ) : null}

        {isLateNight ? <Banner>{`🌙 Late night — showing ${format(parsedDate, "EEEE, MMM d")} habits. Your new day starts later.`}</Banner> : null}

        <Pressable onPress={openDayLog} style={[styles.summary, { backgroundColor: c.muted }]}>
          <Txt size={12.5} muted>⏱ {plannedMins > 0 ? `~${fmtMins(plannedMins)} planned` : "0 mins planned"}</Txt>
          <Txt size={12.5} weight="600" style={{ color: c.primary }}>Day Log →</Txt>
        </Pressable>

        {data ? (
          <>
            {renderTimeSection(upcomingKeys[0], "pending")}
            {renderAllDay("pending")}
            {upcomingKeys.slice(1).map((k) => renderTimeSection(k, "pending"))}
            {pastKeys.map((k) => renderTimeSection(k, "pending"))}

            {hasCompleted ? (
              <Accordion title="Completed" open={completedOpen} onToggle={() => setCompletedOpen((v) => !v)}>
                {ALL_KEYS.map((k) => renderTimeSection(k, "completed"))}
                {renderAllDay("completed")}
                {satisfiedHabits.length > 0 ? (
                  <View>
                    <SectionHeader left="Weekly goals met" faded />
                    <View style={{ gap: 8 }}>
                      {satisfiedHabits.map((h) => (
                        <HabitCard key={h.id} habit={h} today={dateStr} groups={groups} onSkip={() => handleHabitSkip(h)} onUnskip={() => handleHabitUnskip(h)} onEdit={() => setEditHabit(h)} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Accordion>
            ) : null}

            {hasSkipped ? (
              <Accordion title="Skipped" open={skippedOpen} onToggle={() => setSkippedOpen((v) => !v)}>
                {ALL_KEYS.map((k) => renderTimeSection(k, "skipped"))}
                {renderAllDay("skipped")}
              </Accordion>
            ) : null}

            {totalCount === 0 ? <EmptyState emoji="🌟" title="Build your routine" body="Tap + to add habits, tasks, and events." /> : null}

            {weekHabits.length > 0 && weekDays.length === 7 ? (
              <Accordion title="This Week" open={weekOpen} onToggle={() => setWeekOpen((v) => !v)}>
                <View style={styles.weekRow}>
                  {weekDays.map((d) => (
                    <Txt key={d.toISOString()} size={12} muted style={styles.weekCell}>{format(d, "EEEEE")}</Txt>
                  ))}
                </View>
                {WEEK_SECTIONS.map((sec) => {
                  const list = weekHabits.filter((h) => (habitSection(h) ?? "all_day") === sec);
                  if (list.length === 0) return null;
                  return (
                    <View key={sec} style={{ gap: 10 }}>
                      <Overline style={{ fontSize: 10 }}>{WEEK_SECTION_LABELS[sec]}</Overline>
                      {list.map((h) => {
                        const target = h.frequency === "daily" ? 7 : h.target;
                        const done = Number(h.completions_this_week);
                        const completed = new Set(h.completions_by_date ?? []);
                        const skipped = new Set(h.skipped_dates ?? []);
                        const showDayStatus = h.frequency !== "weekly";
                        return (
                          <View key={h.id} style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Txt size={12} weight="500" numberOfLines={1} style={{ flex: 1 }}>{h.name}</Txt>
                              <Txt size={12} muted>{done}/{target}</Txt>
                            </View>
                            <View style={styles.weekRow}>
                              {weekDays.map((d) => {
                                const ds = format(d, "yyyy-MM-dd");
                                const isDone = completed.has(ds);
                                const isSkip = skipped.has(ds);
                                const missed = showDayStatus && isHabitScheduledForDay(h, d) && !isDone && !isSkip && isBefore(startOfDay(d), startOfDay(parsedDate));
                                return (
                                  <View key={ds} style={styles.weekCell}>
                                    <View
                                      accessibilityLabel={`${format(d, "EEE MMM d")}: ${isDone ? "completed" : isSkip ? "skipped" : missed ? "missed" : "not done"}`}
                                      style={[styles.dot, { backgroundColor: isDone ? c.primary : isSkip ? c.warningBg : c.muted }]}
                                    >
                                      {isDone ? <Ionicons name="checkmark" size={13} color={c.primaryForeground} /> : null}
                                      {isSkip ? <Ionicons name="play-skip-forward" size={11} color={c.warning} /> : null}
                                      {missed ? <Ionicons name="close" size={13} color={c.mutedForeground} /> : null}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                            <ProgressBar pct={Math.min(100, (done / Math.max(1, target)) * 100)} />
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </Accordion>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Add button + menu */}
      {fabOpen ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setFabOpen(false)} accessibilityLabel="Close menu" /> : null}
      <View style={[styles.fabWrap, { bottom: 16 }]}>
        {fabOpen ? (
          <View style={[styles.fabMenu, { backgroundColor: c.card, borderColor: c.border }]}>
            {FAB_OPTIONS.map((o) => (
              <Pressable key={o.tab} onPress={() => { setFabOpen(false); setAddTab(o.tab); }} style={({ pressed }) => [styles.fabItem, pressed && { backgroundColor: c.muted }]}>
                <Text style={{ fontSize: 16 }}>{o.icon}</Text>
                <Txt weight="500">{o.label}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={() => setFabOpen((v) => !v)}
          accessibilityLabel="Add item"
          accessibilityState={{ expanded: fabOpen }}
          style={[styles.fab, { backgroundColor: c.primary, transform: [{ rotate: fabOpen ? "45deg" : "0deg" }] }]}
        >
          <Ionicons name="add" size={30} color={c.primaryForeground} />
        </Pressable>
      </View>

      <AddItemSheet
        open={addTab != null}
        onClose={() => setAddTab(null)}
        defaultTab={addTab ?? "habit"}
        defaultDate={dateStr}
        groups={groups}
        progressUnits={data?.settings.progress_units ?? ["mins", "hrs"]}
      />
      <EditHabitSheet habit={editHabit} onClose={() => setEditHabit(null)} groups={groups} progressUnits={data?.settings.progress_units ?? ["mins", "hrs"]} />
      <EditEventSheet event={editEvent} onClose={() => setEditEvent(null)} groups={groups} />

      <Sheet open={dayLogOpen} onClose={() => setDayLogOpen(false)} title={`Day log · ${format(parsedDate, "MMM d")}`}>
        {!dayLog ? (
          <Txt muted style={{ textAlign: "center" }}>Loading…</Txt>
        ) : dayLog.habitEntries.length === 0 && dayLog.eventEntries.length === 0 ? (
          <Txt muted style={{ textAlign: "center" }}>Nothing completed on this day.</Txt>
        ) : (
          <View style={{ gap: 10 }}>
            {dayLog.habitEntries.map((e) => (
              <View key={e.habit_id} style={styles.logRow}>
                <Text>💪</Text>
                <View style={{ flex: 1 }}>
                  <Txt weight="500" numberOfLines={1}>{e.habit_name}</Txt>
                  {e.progress_metric && e.progress_value != null ? <Txt size={12} muted>{e.progress_value} {e.progress_metric}</Txt> : null}
                </View>
                <Txt size={12} muted>{e.duration_actual != null ? fmtMins(e.duration_actual) : "—"}</Txt>
              </View>
            ))}
            {dayLog.eventEntries.map((e) => (
              <View key={e.event_id} style={styles.logRow}>
                <Text>📅</Text>
                <Txt weight="500" numberOfLines={1} style={{ flex: 1 }}>{e.event_title}</Txt>
                <Txt size={12} muted>{(e.duration_actual ?? e.duration_computed) != null ? fmtMins((e.duration_actual ?? e.duration_computed)!) : "—"}</Txt>
              </View>
            ))}
            <View style={[styles.logRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 10 }]}>
              <Txt weight="600" style={{ flex: 1 }}>Total tracked</Txt>
              <Txt weight="700" style={{ color: c.primary }}>{fmtMins(dayLog.totalTrackedMinutes)}</Txt>
            </View>
          </View>
        )}
      </Sheet>
    </View>
  );
}

function SectionHeader({ left, right, faded }: { left: string; right?: string; faded?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <Overline style={faded && { opacity: 0.6 }}>{left}</Overline>
      {right ? <Txt size={11} muted style={faded && { opacity: 0.6 }}>{right}</Txt> : null}
    </View>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const c = useColors();
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <View style={{ width: 46, height: 46 }} accessibilityLabel={`${done} of ${total} items done`}>
      <Svg width={46} height={46} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={23} cy={23} r={r} fill="none" stroke={c.muted} strokeWidth={3} />
        <Circle cx={23} cy={23} r={r} fill="none" stroke={c.primary} strokeWidth={3} strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Txt size={11} weight="700">{done}<Text style={{ color: c.mutedForeground, fontWeight: "400" }}>/{total}</Text></Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  weekRow: { flexDirection: "row" },
  weekCell: { flex: 1, alignItems: "center", textAlign: "center" },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  fabWrap: { position: "absolute", right: 16, alignItems: "flex-end", gap: 8 },
  fabMenu: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: "hidden", minWidth: 150, elevation: 6 },
  fabItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", elevation: 6 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10 },
});
