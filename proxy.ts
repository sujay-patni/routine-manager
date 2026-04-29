import { NextResponse, type NextRequest } from "next/server";
import { verifyCookie, getCookieName } from "@/lib/auth";
import { isDeviceAllowed } from "@/lib/notion/devices";

const ALWAYS_PUBLIC = [
  "/_next",
  "/api",
  "/icons",
  "/manifest.json",
  "/sw.js",
  "/favicon.ico",
  "/blocked",
];

const DEVICE_COOKIE = "device_id";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static/public paths
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Authenticated users skip device check entirely
  const authCookie = request.cookies.get(getCookieName())?.value;
  if (verifyCookie(authCookie)) {
    return NextResponse.next();
  }

  // Assign a device ID if this is a new device
  let deviceId = request.cookies.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    const url = request.nextUrl.clone();
    url.pathname = "/blocked";
    const res = NextResponse.redirect(url);
    res.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: DEVICE_COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  }

  // Check device against Notion whitelist
  const allowed = await isDeviceAllowed(deviceId);
  if (!allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/blocked";
    return NextResponse.redirect(url);
  }

  // Device is allowed but not authenticated — redirect to unlock
  if (pathname !== "/unlock") {
    const url = request.nextUrl.clone();
    url.pathname = "/unlock";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
