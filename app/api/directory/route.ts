import { NextResponse, type NextRequest } from "next/server";
import { byUuids, egyptAll, searchByName, DirectoryUnavailable } from "@/lib/server/radioBrowser";
import { catalogById } from "@/lib/catalog";
import { isCandidate } from "@/lib/match";
import type { DirectoryStation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/directory?q=<text>&country=EG         → name search (merged Arabic variants)
 * GET /api/directory?uuids=<uuid,uuid>           → live records for known stations
 * GET /api/directory?prefixes=<8hex,8hex>        → Egyptian records whose UUID starts with a prefix
 * GET /api/directory?candidates=<catalogId>      → strict candidates for a catalog station (Egypt only, unless the station allows any country)
 * Metadata only. Protected by middleware (session cookie).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    let stations: DirectoryStation[] = [];
    if (p.get("prefixes")) {
      const pre = p.get("prefixes")!.split(",").filter((x) => /^[0-9a-f-]{8,36}$/i.test(x)).slice(0, 20);
      stations = pre.length ? (await egyptAll()).filter((d) => pre.some((x) => d.uuid.startsWith(x.toLowerCase()))) : [];
    } else if (p.get("uuids")) {
      stations = await byUuids(p.get("uuids")!.split(","));
    } else if (p.get("candidates")) {
      const st = catalogById.get(p.get("candidates")!);
      if (!st?.match) return NextResponse.json({ error: "unknown-station" }, { status: 404 });
      const found = new Map<string, DirectoryStation>();
      const terms = [...st.match.names, st.nameAr, st.nameEn].slice(0, 6);
      const settled = await Promise.allSettled(terms.map((t) => searchByName(t, { countrycode: st.match!.anyCountry ? undefined : "EG", limit: 30 })));
      if (!settled.some((r) => r.status === "fulfilled")) throw new DirectoryUnavailable("candidates");
      for (const r of settled) if (r.status === "fulfilled") for (const d of r.value) if (isCandidate(st, d)) found.set(d.uuid, d);
      stations = [...found.values()];
    } else {
      const q = p.get("q") ?? "";
      const country = p.get("country") ?? undefined;
      stations = await searchByName(q, { countrycode: country, limit: 40 });
    }
    return NextResponse.json(
      { stations, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (e) {
    const unavailable = e instanceof DirectoryUnavailable;
    return NextResponse.json(
      { error: unavailable ? "directory-unavailable" : "directory-error" },
      { status: unavailable ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
