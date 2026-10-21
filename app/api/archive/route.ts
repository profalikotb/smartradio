import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/archive?ids=<identifier>[,<identifier>…]
 * Audio track list of Internet Archive items (e.g. collections of rare recitations), so a station can
 * play them one after another. Original MP3 files only (no derivatives). Protected by middleware.
 */
export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9._-]{3,100}$/;

interface IaFile {
  name: string;
  source?: string;
  format?: string;
  title?: string;
  length?: string;
  size?: string;
}

export interface ArchiveTrack {
  url: string;
  label: string;
  seconds?: number;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

async function tracksOf(id: string): Promise<ArchiveTrack[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`https://archive.org/metadata/${id}`, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`archive ${r.status}`);
    const meta = (await r.json()) as { files?: IaFile[]; dir?: string };
    const audio = (meta.files ?? []).filter((f) => f.source === "original" && /\.mp3$/i.test(f.name) && /mp3/i.test(f.format ?? "mp3"));
    // Per-file titles are often one placeholder repeated on every file; use them only when distinctive.
    const counts = new Map<string, number>();
    for (const f of audio) if (f.title) counts.set(f.title, (counts.get(f.title) ?? 0) + 1);
    return audio
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((f) => {
        const base = f.name.split("/").pop()!.replace(/\.mp3$/i, "").replace(/[_]+/g, " ").trim();
        const title = f.title && (counts.get(f.title) ?? 0) <= 2 ? f.title.trim() : "";
        const seconds = f.length ? Number(f.length.includes(":") ? f.length.split(":").reduce((a, x) => a * 60 + Number(x), 0) : f.length) : undefined;
        return {
          url: `https://archive.org/download/${id}/${f.name.split("/").map(encodeURIComponent).join("/")}`,
          label: title || (/[\u0600-\u06FF]{2}/.test(base) ? base : `تلاوة رقم ${/(\d+)\D*$/.exec(base)?.[1] ?? base}`),
          seconds: seconds && Number.isFinite(seconds) ? Math.round(seconds) : undefined,
        };
      })
      // Skip fragments under 30 s (intros, test files).
      .filter((x) => !x.seconds || x.seconds >= 30);
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => ID.test(x)).slice(0, 8);
  if (!ids.length) return NextResponse.json({ error: "bad-ids" }, { status: 400 });
  const settled = await Promise.allSettled(ids.map(tracksOf));
  const tracks = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (!tracks.length) return NextResponse.json({ error: "archive-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ tracks }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
