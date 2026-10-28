// Exports everything in the Neon database into a backup file the Android app
// can import (Settings → Backup & restore → Restore from file).
//
//   npm run db:export-mobile                 # writes routine-backup-<date>.json
//   npm run db:export-mobile -- my-file.json
import { writeFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

// Same table list as mobile/src/lib/backup.ts. allowed_devices is web-only.
const TABLES = ["groups", "habits", "completions", "events", "settings", "skips", "vacations"] as const;

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set (add it to .env.local).");
  const query = neon(url);

  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const name of TABLES) {
    const rows = (await query.query(`SELECT * FROM ${name}`)) as Record<string, unknown>[];
    tables[name] = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
      )
    );
  }

  const backup = {
    format: "routine-backup",
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };

  const out = process.argv[2] ?? `routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(out, JSON.stringify(backup, null, 2));
  const counts = Object.entries(tables).map(([k, v]) => `${k}: ${v.length}`).join(", ");
  console.log(`Wrote ${out} (${counts})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
