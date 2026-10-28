// Light / dark / system choice, saved on this phone only (like the web
// app's per-browser setting). Applied app-wide through Appearance.
import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { getSqlite } from "./db/client";

export type ThemePref = "light" | "dark" | "system";

const KEY = "theme";
let current: ThemePref = "system";
const listeners = new Set<(t: ThemePref) => void>();

function apply(t: ThemePref) {
  Appearance.setColorScheme(t === "system" ? "unspecified" : t);
}

/** Call once after the database is ready, before the first screen renders. */
export async function loadThemePref(): Promise<void> {
  const row = await getSqlite().getFirstAsync<{ value: string }>("SELECT value FROM prefs WHERE key = ?", KEY);
  const v = row?.value;
  current = v === "light" || v === "dark" ? v : "system";
  apply(current);
}

export async function setThemePref(t: ThemePref): Promise<void> {
  current = t;
  apply(t);
  for (const l of listeners) l(t);
  await getSqlite().runAsync("INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)", KEY, t);
}

export function useThemePref(): ThemePref {
  const [t, setT] = useState(current);
  useEffect(() => {
    listeners.add(setT);
    return () => {
      listeners.delete(setT);
    };
  }, []);
  return t;
}
