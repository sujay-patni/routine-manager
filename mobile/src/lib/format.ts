import { Platform, ToastAndroid, Alert } from "react-native";

export function fmtMins(m: number): string {
  const mins = Math.round(m);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/** "14:05" → "2:05 PM" */
export function fmtClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

/** ISO timestamp → local "2:05 PM" */
export function fmtIsoTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtClock(iso.includes("T") ? iso.split("T")[1] : iso);
  return fmtClock(`${d.getHours()}:${d.getMinutes()}`);
}

/** Local YYYY-MM-DD for a Date (not UTC). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function toast(message: string) {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}

export function friendlyError(error: unknown): string {
  const msg = String(error ?? "");
  if (msg.includes("UNIQUE")) return "That already exists.";
  return msg.replace(/^Error:\s*/, "") || "Something went wrong.";
}

export function toastError(title: string, error?: unknown) {
  if (Platform.OS === "android") ToastAndroid.show(error ? `${title}: ${friendlyError(error)}` : title, ToastAndroid.LONG);
  else Alert.alert(title, error ? friendlyError(error) : undefined);
}
