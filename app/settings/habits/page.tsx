export const dynamic = "force-dynamic";

import { getAllGroups } from "@/app/actions/groups";
import { getAllHabits } from "@/app/actions/habits";
import HabitsClient from "./HabitsClient";

export default async function HabitsPage() {
  const [habits, groups] = await Promise.all([getAllHabits(), getAllGroups()]);

  return <HabitsClient habits={habits} groups={groups} />;
}
