import { NextResponse } from "next/server";

/** GET /api/yt-titles?ids=a,b,c → { titles: { id: title } } via YouTube's public oEmbed endpoint. */
export const dynamic = "force-dynamic";

const ID = /^[\w-]{11}$/;

async function title(id: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string };
    return typeof j.title === "string" ? j.title : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => ID.test(x)))].slice(0, 60);
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const got = await Promise.all(chunk.map(title));
    chunk.forEach((id, k) => {
      if (got[k]) out[id] = got[k]!;
    });
  }
  return NextResponse.json({ titles: out }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
