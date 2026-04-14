import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createEvent } from "./lib/notion/events";

async function run() {
  try {
    const res = await createEvent({
      title: "Team Standup",
      event_type: "timed",
      start_time: "2026-04-15T12:30:00",
      end_time: "2026-04-15T13:00:00",
      is_recurring: true,
      recurrence_rule: "FREQ=DAILY"
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error expected:", err);
  }
}
run();
