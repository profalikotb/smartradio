import { NextResponse, type NextRequest } from "next/server";
import { isValidHashFormat, verifyPassword } from "@/lib/server/password";
import { createSessionToken, isConfigured, SESSION_COOKIE, sessionDays } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort throttle. Serverless instances don't share memory, so scrypt cost + delay are the real brake.
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX = 8;

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  // A malformed APP_PASSWORD_HASH would otherwise look like "wrong password" forever.
  if (!isValidHashFormat(process.env.APP_PASSWORD_HASH)) return NextResponse.json({ error: "bad-hash" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && now - a.first < WINDOW && a.n >= MAX) return NextResponse.json({ error: "too-many-attempts" }, { status: 429 });

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const ok = password.length > 0 && (await verifyPassword(password, process.env.APP_PASSWORD_HASH));
  if (!ok) {
    attempts.set(ip, a && now - a.first < WINDOW ? { n: a.n + 1, first: a.first } : { n: 1, first: now });
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDays() * 86400,
  });
  return res;
}
