import { getAllHabits } from "./lib/notion/habits";
async function run() {
  const habits = await getAllHabits();
  const jawenfe = habits.find(h => h.name.toLowerCase().includes("jawenfe"));
  console.log(JSON.stringify(jawenfe, null, 2));
}
run();
