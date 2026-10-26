import { NextResponse } from "next/server";
import { buildManifest, SOURCES, type IaFile } from "@/lib/tafsir/parse";

/**
 * GET /api/tafsir → Tafsir Al-Sha'rawi episode manifest (surah → episodes with verse ranges),
 * built from the Internet Archive file lists. Cached for a day at the edge; the browser keeps its
 * own copy for offline browsing.
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
  const input = await Promise.all(SOURCES.map(async (source) => ({ source, files: await filesOf(source.item) })));
  const manifest = buildManifest(input);
  const any = Object.keys(manifest.surahs).length > 0;
  if (!any) return NextResponse.json({ error: "sources-unavailable", sources: manifest.sources }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(manifest, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
