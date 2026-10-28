import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { exportBackup, pickBackupFile, restoreBackup, summarizeBackup } from "@/lib/backup";
import { toast, toastError } from "@/lib/format";
import { Banner, Button, Overline, Txt } from "@/components/ui";

export default function BackupScreen() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  async function doExport() {
    setBusy("export");
    try {
      await exportBackup();
    } catch (e) {
      toastError("Export failed", e);
    }
    setBusy(null);
  }

  async function doImport() {
    setBusy("import");
    try {
      const backup = await pickBackupFile();
      if (!backup) return;
      const n = summarizeBackup(backup);
      const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
      const summary = [plural(n.habits, "habit"), plural(n.completions, "completion"), plural(n.events, "event"), plural(n.groups, "group"), plural(n.vacations, "vacation")].join(", ");
      Alert.alert(
        "Replace everything on this phone?",
        `The backup has ${summary}.\n\nAll current data on this phone will be replaced. Export first if you want to keep it.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            style: "destructive",
            onPress: async () => {
              try {
                await restoreBackup(backup);
                toast("Backup restored");
              } catch (e) {
                toastError("Restore failed", e);
              }
            },
          },
        ]
      );
    } catch (e) {
      toastError("Couldn't read that file", e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
      <Banner>Your routine lives only on this phone. If you lose or reset the phone without a backup, the data is gone.</Banner>

      <View style={{ gap: 8 }}>
        <Overline>Export</Overline>
        <Txt muted>Saves everything to a file you can keep in Google Drive, email to yourself, or store in Files.</Txt>
        <Button title="Export backup" icon="share-outline" onPress={doExport} loading={busy === "export"} />
      </View>

      <View style={{ gap: 8 }}>
        <Overline>Restore</Overline>
        <Txt muted>Load a backup file. This replaces all data on the phone.</Txt>
        <Button title="Restore from file" icon="folder-open-outline" variant="secondary" onPress={doImport} loading={busy === "import"} />
      </View>

      <View style={{ gap: 8 }}>
        <Overline>Moving from the web app</Overline>
        <Txt muted>
          {"On your laptop, in the routine-manager folder, run “npm run db:export-mobile”. It writes a routine-backup file from " +
            "your Neon database. Copy that file to the phone (Drive, USB, or email) and tap Restore from file."}
        </Txt>
      </View>
    </ScrollView>
  );
}
