import { NextResponse, type NextRequest } from "next/server";
import { BlockedError, guardedGetText, parsePlaylist } from "@/lib/server/netguard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolves .pls/.m3u playlist URLs into direct stream URLs (text only, ≤64 KB, ≤6 s, ≤3 redirects,
 * public addresses only). If the URL turns out to be an audio stream it returns it unchanged without
 * reading the audio. Never relays audio.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  try {
    const r = await guardedGetText(url);
    if (/^audio\//i.test(r.contentType)) return NextResponse.json({ hls: false, urls: [r.finalUrl], direct: true });
    if (r.status < 200 || r.status >= 300) return NextResponse.json({ error: "upstream-status", status: r.status }, { status: 502 });
    const parsed = parsePlaylist(r.body, r.finalUrl);
    if (!parsed.urls.length) return NextResponse.json({ error: "no-streams-found" }, { status: 422 });
    return NextResponse.json(parsed, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    if (e instanceof BlockedError) return NextResponse.json({ error: "blocked", reason: e.message }, { status: 400 });
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  }
}
