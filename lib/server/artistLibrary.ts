import { NextResponse } from "next/server";
import { buildLibrary, type IaFile } from "@/lib/umm/parse";
import type { Artist } from "@/lib/umm/artists";

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

/** A singer's library (songs → versions) from the Internet Archive file lists. Edge-cached for a day. */
export async function artistLibraryResponse(artist: Artist) {
  const input = await Promise.all(artist.sources.map(async (source) => ({ source, files: await filesOf(source.item) })));
  const lib = buildLibrary(input, new Date(), artist.parse);
  if (!lib.songs.length) return NextResponse.json({ error: "sources-unavailable", sources: lib.sources }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(lib, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
