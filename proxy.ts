import { NextResponse, type NextRequest } from "next/server";
import { verifyCookie, getCookieName } from "@/lib/auth";

const PUBLIC_PATHS = ["/unlock", "/_next", "/api", "/icons", "/manifest.json", "/sw.js", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for valid auth cookie
  const cookie = request.cookies.get(getCookieName())?.value;
  if (verifyCookie(cookie)) {
    return NextResponse.next();
  }

  // Redirect to unlock screen
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
