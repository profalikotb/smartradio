import { NextResponse, type NextRequest } from "next/server";

/**
 * No password: every page opens directly.
 *
 * The API routes are server-side helpers for this app only (radio directory lookups, playlist
 * resolution, Internet Archive track lists). They hold no secrets, but they must not become a free
 * proxy for other websites, so they answer only requests made by this app's own pages:
 *  - modern browsers mark same-site calls with  Sec-Fetch-Site: same-origin
 *  - older browsers: our client always sends  X-Smart-Radio: 1 ; another website cannot add that
 *    header to a cross-origin request without a CORS preflight, which these routes never approve.
 * The old login endpoints are retired.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return withHeaders(NextResponse.redirect(new URL("/", req.url)));
  if (pathname === "/api/login" || pathname === "/api/logout") return withHeaders(NextResponse.json({ error: "gone" }, { status: 410 }));
  if (pathname.startsWith("/api/")) {
    const site = req.headers.get("sec-fetch-site");
    const own = site === "same-origin" || req.headers.get("x-smart-radio") === "1";
    if (!own) return withHeaders(NextResponse.json({ error: "forbidden" }, { status: 403 }));
  }
  return withHeaders(NextResponse.next());
}

function withHeaders(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|offline.html|favicon.ico|robots.txt).*)"],
};
