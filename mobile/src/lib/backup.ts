// Backup file format shared with the web app's scripts/export-for-mobile.ts.
// Rows use the database column names (snake_case), with real booleans and arrays.
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import { getSqlite } from "./db/client";
import { clearSettingsCache } from "./services/settings";
import { notifyDataChanged } from "./store";

export const BACKUP_FORMAT = "routine-backup";
export const BACKUP_VERSION = 1;

type Row = Record<string, unknown>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  tables: Partial<Record<TableName, Row[]>>;
}

const TABLES = {
  groups: { booleans: [], json: [] },
  habits: { booleans: ["is_active"], json: [] },
  completions: { booleans: [], json: [] },
  events: { booleans: ["is_recurring", "is_completed"], json: ["completed_dates"] },
  settings: { booleans: [], json: ["progress_units"] },
  skips: { booleans: [], json: [] },
  vacations: { booleans: ["is_template"], json: ["habit_ids", "group_ids"] },
} as const satisfies Record<string, { booleans: readonly string[]; json: readonly string[] }>;

type TableName = keyof typeof TABLES;
const TABLE_NAMES = Object.keys(TABLES) as TableName[];

const REQUIRED_CREATED_AT: TableName[] = ["habits", "completions", "events", "skips", "vacations"];

function toPortable(table: TableName, row: Row): Row {
  const out: Row = { ...row };
  for (const col of TABLES[table].booleans) out[col] = out[col] === 1 || out[col] === true;
  for (const col of TABLES[table].json) {
    const v = out[col];
    if (typeof v === "string") {
      try {
        out[col] = JSON.parse(v);
      } catch {
        out[col] = [];
      }
    }
  }
  return out;
}

function toSqlite(table: TableName, row: Row): Row {
  const out: Row = { ...row };
  for (const col of TABLES[table].booleans) out[col] = out[col] === true || out[col] === 1 || out[col] === "true" ? 1 : 0;
  for (const col of TABLES[table].json) {
    const v = out[col];
    out[col] = typeof v === "string" ? v : JSON.stringify(Array.isArray(v) ? v : []);
  }
  if (REQUIRED_CREATED_AT.includes(table) && !out.created_at) out.created_at = new Date().toISOString();
  return out;
}

export async function buildBackup(): Promise<BackupFile> {
  const db = getSqlite();
  const tables: BackupFile["tables"] = {};
  for (const name of TABLE_NAMES) {
    const rows = await db.getAllAsync<Row>(`SELECT * FROM ${name}`);
    tables[name] = rows.map((r) => toPortable(name, r));
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: new Date().toISOString(), tables };
}

/** Writes a backup file and opens the Android share sheet (Drive, email, Files…). */
export async function exportBackup(): Promise<void> {
  const backup = await buildBackup();
  const file = new File(Paths.cache, `routine-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Save Rise backup" });
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const b = data as Partial<BackupFile>;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object" || !b.tables) {
    throw new Error("That file is not a Rise backup.");
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of the app.");
  }
  return b as BackupFile;
}

export function summarizeBackup(b: BackupFile): Record<TableName, number> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, b.tables[t]?.length ?? 0])) as Record<TableName, number>;
}

/** Replaces everything on the phone with the backup's contents. */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const db = getSqlite();
  const columnsByTable = new Map<TableName, Set<string>>();
  for (const name of TABLE_NAMES) {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${name})`);
    columnsByTable.set(name, new Set(cols.map((c) => c.name)));
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const name of TABLE_NAMES) await txn.runAsync(`DELETE FROM ${name}`);
    for (const name of TABLE_NAMES) {
      const allowed = columnsByTable.get(name)!;
      for (const raw of b.tables[name] ?? []) {
        const row = toSqlite(name, raw);
        const cols = Object.keys(row).filter((c) => allowed.has(c));
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => "?").join(", ");
        const values = cols.map((c) => {
          const v = row[c];
          return v === undefined ? null : (v as string | number | null);
        });
        await txn.runAsync(`INSERT OR REPLACE INTO ${name} (${cols.join(", ")}) VALUES (${placeholders})`, values);
      }
    }
  });

  clearSettingsCache();
  notifyDataChanged();
}

export async function pickBackupFile(): Promise<BackupFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
  if (res.canceled) return null;
  const text = await new File(res.assets[0].uri).text();
  return parseBackup(text);
}
