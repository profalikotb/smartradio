import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";

/** Fail-closed gate for every page and API route except the login flow and static PWA assets. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) {
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return withHeaders(NextResponse.next());
  }
  if (pathname === "/login" || pathname === "/api/login") return withHeaders(NextResponse.next());
  if (pathname.startsWith("/api/")) return withHeaders(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return withHeaders(NextResponse.redirect(login));
}

function withHeaders(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Public: Next assets, icons, manifest, service worker, offline page. They contain no personal data.
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|offline.html|favicon.ico|robots.txt).*)"],
};
