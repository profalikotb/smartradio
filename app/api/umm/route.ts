import { NextResponse } from "next/server";
import { buildLibrary, UMM_SOURCES, type IaFile } from "@/lib/umm/parse";

/**
 * GET /api/umm → Umm Kulthum library (songs → versions), built from the Internet Archive file lists.
 * Cached for a day at the edge; the browser keeps its own copy for offline browsing.
 */
export const dynamic = "force-dynamic";

async function filesOf(item: string): Promise<IaFile[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://archive.org/metadata/${item}`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { files?: IaFile[] };
    return Array.isArray(j.files) ? j.files : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const input = await Promise.all(UMM_SOURCES.map(async (source) => ({ source, files: await filesOf(source.item) })));
  const lib = buildLibrary(input);
  if (!lib.songs.length) return NextResponse.json({ error: "sources-unavailable", sources: lib.sources }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(lib, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
