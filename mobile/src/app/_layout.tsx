import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrateDb } from "@/lib/db/client";
import { syncHealth } from "@/lib/health/sync";
import { useColors } from "@/lib/theme";
import { Txt } from "@/components/ui";

export default function RootLayout() {
  const c = useColors();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    migrateDb()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  // Pull fresh Health Connect data on launch and whenever the app comes back.
  useEffect(() => {
    if (!ready) return;
    syncHealth().catch(() => {});
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") syncHealth().catch(() => {});
    });
    return () => sub.remove();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24 }}>
        {error ? <Txt style={{ color: c.destructive, textAlign: "center" }}>{`Couldn't open the database: ${error}`}</Txt> : <ActivityIndicator color={c.primary} />}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.foreground,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings/habits" options={{ title: "Habits" }} />
        <Stack.Screen name="settings/groups" options={{ title: "Groups" }} />
        <Stack.Screen name="settings/vacations" options={{ title: "Vacations" }} />
        <Stack.Screen name="settings/health" options={{ title: "Health Connect" }} />
        <Stack.Screen name="settings/backup" options={{ title: "Backup & restore" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
