import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "routine_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Rate limiting: max 5 attempts per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

function getCookieSecret(): string | null {
  return process.env.COOKIE_SECRET?.trim() || null;
}

export function signCookie(value: string): string {
  const secret = getCookieSecret();
  if (!secret) {
    throw new Error("COOKIE_SECRET is required to sign auth cookies.");
  }
  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function verifyCookie(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const secret = getCookieSecret();
  if (!secret) return false;
  const lastDot = cookie.lastIndexOf(".");
  if (lastDot === -1) return false;
  const value = cookie.slice(0, lastDot);
  const sig = cookie.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getCookieMaxAge(): number {
  return COOKIE_MAX_AGE;
}

export function checkRateLimit(ip: string): { allowed: boolean; minutesLeft?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return { allowed: false, minutesLeft };
  }

  entry.count += 1;
  return { allowed: true };
}

export function resetRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}
