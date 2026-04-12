export const dynamic = "force-dynamic";

import { getSettings } from "@/app/actions/settings";
import { getAllHabits } from "@/app/actions/habits";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const [settings, habits] = await Promise.all([
    getSettings(),
    getAllHabits(),
  ]);

  return <SettingsClient settings={settings} habits={habits} />;
}
