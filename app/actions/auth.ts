"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  signCookie,
  getCookieName,
  getCookieMaxAge,
  checkRateLimit,
  resetRateLimit,
} from "@/lib/auth";

export async function validatePassphrase(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const input = (formData.get("passphrase") as string ?? "").trim();
  const from = (formData.get("from") as string) || "/today";

  // Get IP for rate limiting
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const { allowed, minutesLeft } = checkRateLimit(ip);
  if (!allowed) {
    return {
      error: `Too many attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
    };
  }

  const passphrase = process.env.APP_PASSPHRASE;
  if (!passphrase) {
    return { error: "App is not configured. Set APP_PASSPHRASE env var." };
  }

  if (input !== passphrase) {
    return { error: "Incorrect passphrase." };
  }

  // Correct — clear rate limit, set signed cookie
  resetRateLimit(ip);

  const cookieStore = await cookies();
  cookieStore.set(getCookieName(), signCookie("authenticated"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: getCookieMaxAge(),
    path: "/",
  });

  redirect(from.startsWith("/") ? from : "/today");
}
