import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Raw server-action errors can be full Postgres/driver messages — too long
// and too technical to show in a toast.
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!msg || msg.length > 120 || /(pg|postgres|sql|relation|column|connect|ECONN|fetch failed)/i.test(msg)) {
    return fallback;
  }
  return msg;
}
