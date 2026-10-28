// Twelve small months for the Calendar's Year view, ported from the web
// app's YearView. Days with events show a dot; tap a month to open it.
import { Pressable, View } from "react-native";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import type { AppEvent } from "@/lib/types";
import { radius, useColors } from "@/lib/theme";
import { Txt } from "./ui";
import { TYPE_COLORS } from "./TimeGrid";

export default function YearGrid({ year, weekStartsOn, eventsByDate, onOpenMonth }: {
  year: number;
  weekStartsOn: 0 | 1;
  eventsByDate: Map<string, AppEvent[]>;
  onOpenMonth: (month: Date) => void;
}) {
  const c = useColors();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  const labels = weekStartsOn === 1 ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
      {months.map((m) => {
        const days = eachDayOfInterval({
          start: startOfWeek(startOfMonth(m), { weekStartsOn }),
          end: endOfWeek(endOfMonth(m), { weekStartsOn }),
        });
        return (
          <View key={m.toISOString()} style={{ width: "33.333%", padding: 4 }}>
            <Pressable
              onPress={() => onOpenMonth(m)}
              accessibilityLabel={`Open ${format(m, "MMMM yyyy")}`}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                backgroundColor: pressed ? c.muted : c.card,
                padding: 6,
              })}
            >
              <Txt size={12} weight="700" style={{ marginBottom: 4 }}>{format(m, "MMMM")}</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {labels.map((l, i) => (
                  <Txt key={`l${i}`} size={8} muted style={{ width: `${100 / 7}%`, textAlign: "center" }}>{l}</Txt>
                ))}
                {days.map((d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  const inMonth = isSameMonth(d, m);
                  const evs = eventsByDate.get(ds) ?? [];
                  const isToday = ds === todayStr;
                  return (
                    <View key={ds} style={{ width: `${100 / 7}%`, height: 14, alignItems: "center", justifyContent: "center" }}>
                      {!inMonth ? null : isToday ? (
                        <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
                          <Txt size={7} weight="700" style={{ color: c.primaryForeground }}>{format(d, "d")}</Txt>
                        </View>
                      ) : evs.length > 0 ? (
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: TYPE_COLORS[evs[0].event_type] }} />
                      ) : (
                        <Txt size={8}>{format(d, "d")}</Txt>
                      )}
                    </View>
                  );
                })}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
