// Hour-by-hour grid for the Calendar's Day and Week views, ported from the
// web app's DayView/WeekView. Tap an event to open it, tap empty space to
// add an event on that day.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { format } from "date-fns";
import type { AppEvent, Group } from "@/lib/types";
import { parseZonedOrLocal } from "@/lib/habit-logic";
import { radius, useColors } from "@/lib/theme";
import { fmtClock } from "@/lib/format";
import { Txt } from "./ui";

const PX_PER_HOUR = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LABEL_W = 44;
export const TYPE_COLORS: Record<AppEvent["event_type"], string> = { timed: "#3b82f6", all_day: "#10b981", deadline: "#f97316" };

function hourLabel(h: number) {
  if (h === 0) return "";
  return h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
}

function minutesOf(iso: string | null, tz: string): number | null {
  if (!iso) return null;
  const d = parseZonedOrLocal(iso, tz);
  return d.getHours() * 60 + d.getMinutes();
}

export default function TimeGrid({ days, eventsByDate, groups, timezone, onOpenEvent, onAddOnDay }: {
  days: Date[];
  eventsByDate: Map<string, AppEvent[]>;
  groups: Group[];
  timezone: string;
  onOpenEvent: (e: AppEvent) => void;
  onAddOnDay: (date: string) => void;
}) {
  const c = useColors();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowStr = format(now, "yyyy-MM-dd");
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const single = days.length === 1;
  const colorFor = (e: AppEvent) => groups.find((g) => g.id === e.group_id)?.color ?? TYPE_COLORS[e.event_type];
  const dayStrs = days.map((d) => format(d, "yyyy-MM-dd"));
  const allDay = (ds: string) => (eventsByDate.get(ds) ?? []).filter((e) => e.event_type !== "timed");
  const timed = (ds: string) => (eventsByDate.get(ds) ?? []).filter((e) => e.event_type === "timed" && e.start_time);
  const hasAllDay = dayStrs.some((ds) => allDay(ds).length > 0);

  return (
    <View style={{ flex: 1 }}>
      {!single ? (
        <View style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ width: LABEL_W }} />
          {days.map((d, i) => {
            const isToday = dayStrs[i] === nowStr;
            return (
              <Pressable key={dayStrs[i]} onPress={() => onAddOnDay(dayStrs[i])} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                <Txt size={11} muted>{format(d, "EEE")}</Txt>
                <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? c.primary : "transparent" }}>
                  <Txt size={14} weight="600" style={isToday ? { color: c.primaryForeground } : undefined}>{format(d, "d")}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {hasAllDay ? (
        <View style={[styles.row, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 }]}>
          <View style={{ width: LABEL_W, justifyContent: "center", alignItems: "flex-end", paddingRight: 6 }}>
            <Txt size={10} muted>All day</Txt>
          </View>
          {dayStrs.map((ds) => (
            <View key={ds} style={{ flex: 1, paddingHorizontal: 1, gap: 2 }}>
              {allDay(ds).slice(0, single ? 10 : 2).map((e) => (
                <Pressable key={e.id} onPress={() => onOpenEvent(e)} style={[styles.chip, { backgroundColor: colorFor(e) }]}>
                  <Text numberOfLines={1} style={styles.chipText}>{e.title}</Text>
                </Pressable>
              ))}
              {!single && allDay(ds).length > 2 ? <Txt size={9} muted style={{ textAlign: "center" }}>+{allDay(ds).length - 2}</Txt> : null}
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView contentOffset={{ x: 0, y: PX_PER_HOUR * 7 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.row, { height: PX_PER_HOUR * 24 }]}>
          <View style={{ width: LABEL_W }}>
            {HOURS.map((h) => (
              <Txt key={h} size={10} muted style={{ position: "absolute", right: 6, top: h * PX_PER_HOUR - 7 }}>{hourLabel(h)}</Txt>
            ))}
          </View>
          {dayStrs.map((ds) => (
            <View key={ds} style={{ flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border }}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => onAddOnDay(ds)}
                accessibilityLabel={`Add event on ${ds}`}
              />
              {HOURS.map((h) => (
                <View key={h} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: h * PX_PER_HOUR, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }} />
              ))}
              {timed(ds).map((e) => {
                const start = minutesOf(e.start_time, timezone) ?? 0;
                const end = minutesOf(e.end_time, timezone);
                const dur = Math.max(30, end != null && end > start ? end - start : 60);
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => onOpenEvent(e)}
                    style={[
                      styles.block,
                      {
                        top: start * (PX_PER_HOUR / 60),
                        height: dur * (PX_PER_HOUR / 60),
                        backgroundColor: colorFor(e),
                        opacity: e.is_completed ? 0.55 : 1,
                      },
                    ]}
                  >
                    {dur < 40 ? (
                      // Short blocks: one line so text never spills out of the box.
                      <Text numberOfLines={1} style={styles.blockTitle}>
                        {e.title}
                        {single ? <Text style={styles.blockTime}>{`  ·  ${fmtClock(`${Math.floor(start / 60)}:${start % 60}`)}`}</Text> : null}
                      </Text>
                    ) : (
                      <>
                        <Text numberOfLines={single ? 2 : Math.max(1, Math.floor(dur / 20) - 1)} style={styles.blockTitle}>{e.title}</Text>
                        {single ? <Text numberOfLines={1} style={styles.blockTime}>{fmtClock(`${Math.floor(start / 60)}:${start % 60}`)}</Text> : null}
                      </>
                    )}
                  </Pressable>
                );
              })}
              {ds === nowStr ? (
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: nowMin * (PX_PER_HOUR / 60), flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.destructive, marginLeft: -4 }} />
                  <View style={{ flex: 1, height: 1.5, backgroundColor: c.destructive }} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  chip: { borderRadius: radius.sm, paddingHorizontal: 4, paddingVertical: 2 },
  chipText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  block: { position: "absolute", left: 2, right: 2, borderRadius: radius.sm, paddingHorizontal: 4, paddingVertical: 2, overflow: "hidden", minHeight: 22 },
  blockTitle: { color: "#fff", fontSize: 11, fontWeight: "700" },
  blockTime: { color: "rgba(255,255,255,0.85)", fontSize: 10 },
});
