import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import { settings } from "../lib/db/schema";

loadEnvConfig(process.cwd());

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }

  return parsed;
}

async function main() {
  const db = getDb();
  const existingSettings = await db.select({ id: settings.id }).from(settings);

  if (existingSettings.length > 0) {
    const hasDefaultSeed = existingSettings.some((row) => row.id === "app");
    const hasExistingSettings = existingSettings.some((row) => row.id !== "app");

    if (hasDefaultSeed && hasExistingSettings) {
      await db.delete(settings).where(eq(settings.id, "app"));
      console.log("Removed duplicate default settings row; existing settings were already present.");
      return;
    }

    console.log("Default settings row already exists.");
    return;
  }

  const [row] = await db
    .insert(settings)
    .values({
      id: "app",
      timezone: process.env.TIMEZONE?.trim() || "Asia/Kolkata",
      weekStartDay: intFromEnv("WEEK_START_DAY", 1),
      deadlineSurfaceDays: intFromEnv("DEADLINE_SURFACE_DAYS", 3),
      dayStartHour: intFromEnv("DAY_START_HOUR", 0),
      progressUnits: ["mins", "hrs"],
    })
    .onConflictDoNothing()
    .returning({ id: settings.id });

  console.log(row ? "Seeded default settings row." : "Default settings row already exists.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
