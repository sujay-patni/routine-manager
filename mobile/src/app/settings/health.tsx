import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { connectHealth, getGrantedSources, getHealthStatus, openHealthSettings, syncHealth } from "@/lib/health/sync";
import { getAllHabits } from "@/lib/services/habits";
import type { HealthSource } from "@/lib/types";
import { useLoader } from "@/lib/useLoader";
import { useColors } from "@/lib/theme";
import { toast, toastError } from "@/lib/format";
import { Banner, Button, Card, Overline, Txt } from "@/components/ui";

const LABELS: Record<HealthSource, string> = {
  steps: "Steps",
  sleep_minutes: "Sleep",
  distance_meters: "Distance",
  active_calories: "Active calories",
};

async function load() {
  const [status, granted, habits] = await Promise.all([getHealthStatus(), getGrantedSources(), getAllHabits()]);
  return { status, granted, habits: habits.filter((h) => h.health_source) };
}

export default function HealthScreen() {
  const c = useColors();
  const { data, reload } = useLoader(load, []);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const granted = await connectHealth();
      if (granted.length) {
        const r = await syncHealth();
        toast(`Connected. Updated ${r.updated} day(s).`);
      } else {
        toast("No access granted");
      }
    } catch (e) {
      toastError("Couldn't connect", e);
    }
    setBusy(false);
    reload();
  }

  async function syncNow() {
    setBusy(true);
    try {
      const r = await syncHealth(30);
      toast(`Updated ${r.updated} day(s) from Health Connect`);
    } catch (e) {
      toastError("Sync failed", e);
    }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
      <Txt muted>
        The app reads your steps, sleep, distance and active calories from Health Connect on this phone and logs them into
        habits that have a health source. Nothing leaves the phone.
      </Txt>

      {data?.status === "not_installed" ? (
        <Banner tone="warning">{"Health Connect isn't available. On Android 13 and older, install it from the Play Store."}</Banner>
      ) : null}
      {data?.status === "needs_update" ? (
        <Banner tone="warning">Health Connect needs an update from the Play Store.</Banner>
      ) : null}
      {data?.status === "not_installed" || data?.status === "needs_update" ? (
        <Button
          title="Open Play Store"
          variant="secondary"
          onPress={() => Linking.openURL("market://details?id=com.google.android.apps.healthdata")}
        />
      ) : null}

      {data?.status === "ready" ? (
        <>
          <View style={{ gap: 8 }}>
            <Overline>Access</Overline>
            <Card style={{ gap: 6 }}>
              {(Object.keys(LABELS) as HealthSource[]).map((s) => {
                const on = data.granted.includes(s);
                return (
                  <View key={s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt>{LABELS[s]}</Txt>
                    <Txt weight="600" style={{ color: on ? c.success : c.mutedForeground }}>{on ? "Allowed" : "Not allowed"}</Txt>
                  </View>
                );
              })}
            </Card>
            <Button title={data.granted.length ? "Change access" : "Connect Health Connect"} onPress={connect} loading={busy} />
            {data.granted.length ? <Button title="Open Health Connect settings" variant="ghost" onPress={openHealthSettings} /> : null}
          </View>

          <View style={{ gap: 8 }}>
            <Overline>Linked habits</Overline>
            {data.habits.length === 0 ? (
              <Txt muted>
                No habits use a health source yet. Edit a habit, turn on progress tracking and pick a Health Connect source.
              </Txt>
            ) : (
              data.habits.map((h) => (
                <Card key={h.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt weight="600">{h.name}</Txt>
                  <Txt muted>{LABELS[h.health_source!]}</Txt>
                </Card>
              ))
            )}
            {data.granted.length && data.habits.length ? (
              <Button title="Sync last 30 days now" variant="secondary" onPress={syncNow} loading={busy} />
            ) : null}
          </View>
          <Txt size={12} muted>The app also syncs the last 7 days each time you open it or pull down on Today.</Txt>
        </>
      ) : null}

      {data?.status === "unsupported" ? <Banner>Health Connect is only available on Android.</Banner> : null}
    </ScrollView>
  );
}
