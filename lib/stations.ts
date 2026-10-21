"use client";
/** Turns any station id (catalog / rb:<uuid> / custom:<id>) into something the player can use. */
import { catalogById } from "./catalog";
import { directory, DirectoryError } from "./directoryClient";
import { identityStillMatches } from "./match";
import { categorize } from "./search/rank";
import { getState, update } from "./store";
import type { AppState, Binding } from "./state";
import type { CatalogStation, Category, DirectoryStation, IdentityStatus, PlayableStation, StreamRef } from "./types";

export interface StationView {
  id: string;
  nameAr: string;
  nameEn: string;
  country: string;
  category: Category;
  logo?: string;
  website?: string;
  identity: IdentityStatus;
  core: boolean;
  catalog?: CatalogStation;
  frequency?: string;
}

/**
 * HTTPS candidates for a directory URL. The app is served over HTTPS, and browsers block plain-HTTP
 * audio there. Same host + path over HTTPS is tried first; radiojar (used by Egyptian state radio)
 * serves the same mount on its HTTPS edge stream.radiojar.com. The original URL stays as a last resort.
 */
export function secureVariants(raw: string): string[] {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return [];
  }
  if (u.protocol === "https:") return [u.toString()];
  if (u.protocol !== "http:") return [];
  const out: string[] = [];
  const https = new URL(u.toString());
  https.protocol = "https:";
  if (u.port === "80") https.port = "";
  if (/(^|\.)radiojar\.com$/i.test(u.hostname)) out.push(`https://stream.radiojar.com${u.pathname}${u.search}`);
  out.push(https.toString());
  return [...new Set(out)];
}

export function streamsFromUrls(list: { url: string; codec?: string; bitrate?: number }[]): StreamRef[] {
  const secure: StreamRef[] = [];
  const insecure: StreamRef[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    for (const v of secureVariants(s.url)) if (!seen.has(v)) (seen.add(v), secure.push({ url: v, codec: s.codec, bitrate: s.bitrate, source: "custom" }));
    if (s.url.startsWith("http:") && !seen.has(s.url)) (seen.add(s.url), insecure.push({ url: s.url, codec: s.codec, bitrate: s.bitrate, source: "custom" }));
  }
  return [...secure, ...insecure];
}

/** Healthy, HTTPS, popular listings first. */
export function rankListings(list: DirectoryStation[]): DirectoryStation[] {
  const https = (d: DirectoryStation) => (d.urlResolved || d.url).startsWith("https:");
  return [...list].sort(
    (a, b) => Number(b.lastcheckok) - Number(a.lastcheckok) || Number(https(b)) - Number(https(a)) || (b.votes || 0) - (a.votes || 0) || (b.clickcount || 0) - (a.clickcount || 0),
  );
}

export function streamsFrom(records: DirectoryStation[]): StreamRef[] {
  const secure: StreamRef[] = [];
  const insecure: StreamRef[] = [];
  const seen = new Set<string>();
  for (const d of records) {
    const meta = {
      codec: d.codec || undefined,
      bitrate: d.bitrate || undefined,
      hls: d.hls,
      directoryOk: d.lastcheckok,
      directoryCheckedAt: d.lastcheckoktime || undefined,
      source: "radio-browser" as const,
    };
    for (const raw of [d.urlResolved, d.url]) {
      if (!raw) continue;
      for (const v of secureVariants(raw)) if (!seen.has(v)) (seen.add(v), secure.push({ url: v, ...meta }));
      if (raw.startsWith("http:") && !seen.has(raw)) (seen.add(raw), insecure.push({ url: raw, ...meta }));
    }
  }
  return [...secure, ...insecure];
}

export function playableFromDirectory(group: DirectoryStation[]): PlayableStation {
  const d = group[0]!;
  return {
    id: `rb:${d.uuid}`,
    nameAr: d.name,
    nameEn: d.name,
    country: d.countrycode || d.country,
    category: categorize(d),
    logo: d.favicon || undefined,
    website: d.homepage || undefined,
    identity: "unverified",
    streams: streamsFrom(group),
  };
}

/** Synchronous view for lists/cards. */
export function viewOf(id: string, s: AppState = getState()): StationView | null {
  const c = catalogById.get(id);
  if (c) {
    const bound = s.bindings[id];
    const identity: IdentityStatus = c.identity.status === "catalog-verified" ? "catalog-verified" : bound ? "user-confirmed" : "unverified";
    return {
      id,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      country: "EG",
      category: c.category,
      website: c.website ?? bound?.homepage,
      identity,
      core: !!c.core,
      catalog: c,
      frequency: c.frequency,
      logo: s.known[id]?.logo,
    };
  }
  if (id.startsWith("custom:")) {
    const cu = s.custom.find((x) => `custom:${x.id}` === id);
    if (!cu) return null;
    return { id, nameAr: cu.name, nameEn: cu.name, country: "—", category: "general", identity: "user-confirmed", core: false };
  }
  const k = s.known[id];
  if (!k) return null;
  return { ...k, core: false };
}

export type ResolveResult =
  | { ok: true; station: PlayableStation; fromCache: boolean }
  | { ok: false; reason: "unverified" | "identity-mismatch" | "directory" | "not-found"; detail?: string };

function bindingToPlayable(c: CatalogStation, b: Binding): PlayableStation {
  return {
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    country: "EG",
    category: c.category,
    website: c.website ?? b.homepage,
    identity: "user-confirmed",
    streams: [b.stream, ...b.alternatives],
  };
}

export async function resolveStation(id: string, signal?: AbortSignal): Promise<ResolveResult> {
  const s = getState();
  const c = catalogById.get(id);

  if (c) {
    const override = s.streamOverrides[id];
    if (override || c.directStreams?.length) {
      // A link replaced on this device is tried first; the Excel link stays as the fallback.
      const list = [...(override ? [{ url: override }] : []), ...(c.directStreams ?? []).filter((d) => d.url !== override)];
      const station: PlayableStation = {
        id,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        country: "EG",
        category: c.category,
        website: c.website,
        identity: "catalog-verified",
        streams: streamsFromUrls(list),
      };
      return { ok: true, station, fromCache: false };
    }
    if (c.radioBrowserUuid || c.rbUuidPrefixes?.length) {
      try {
        const [byId, byPre] = await Promise.all([
          c.radioBrowserUuid ? directory.byUuids([c.radioBrowserUuid], signal) : Promise.resolve([]),
          c.rbUuidPrefixes?.length ? directory.byPrefixes(c.rbUuidPrefixes, signal).catch(() => []) : Promise.resolve([]),
        ]);
        const all = [...byId, ...byPre.filter((d) => !byId.some((x) => x.uuid === d.uuid))];
        if (!all.length) return fallbackOr(id, { ok: false, reason: "not-found" });
        const good = all.filter((d) => identityStillMatches(c, d));
        if (!good.length) return { ok: false, reason: "identity-mismatch", detail: all[0]!.homepage };
        // Healthy listings first; their streams are merged (HTTPS variants before HTTP).
        good.sort((a, b) => Number(b.lastcheckok) - Number(a.lastcheckok));
        const rec = good[0]!;
        const station: PlayableStation = {
          id,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          country: "EG",
          category: c.category,
          website: c.website,
          logo: rec.favicon || undefined,
          identity: "catalog-verified",
          streams: streamsFrom(good),
        };
        update((st) => ({ ...st, known: { ...st.known, [id]: station } }));
        return { ok: true, station, fromCache: false };
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        return fallbackOr(id, { ok: false, reason: "directory", detail: e instanceof DirectoryError ? e.kind : "error" });
      }
    }
    const b = s.bindings[id];
    if (b) return { ok: true, station: bindingToPlayable(c, b), fromCache: false };
    // Genre/tribute stations (e.g. Umm Kulthum) with no link: play the best matching directory
    // listing automatically. Every listing passed the strict name rule on the server.
    if (c.match?.anyCountry) {
      try {
        const found = await directory.candidates(id, signal);
        if (!found.length) return fallbackOr(id, { ok: false, reason: "not-found" });
        const ranked = rankListings(found);
        const station: PlayableStation = {
          id,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          country: ranked[0]!.countrycode || "—",
          category: c.category,
          website: ranked[0]!.homepage || c.website,
          logo: ranked[0]!.favicon || undefined,
          identity: "unverified",
          streams: streamsFrom(ranked.slice(0, 6)),
        };
        update((st) => ({ ...st, known: { ...st.known, [id]: station } }));
        return { ok: true, station, fromCache: false };
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        return fallbackOr(id, { ok: false, reason: "directory", detail: e instanceof DirectoryError ? e.kind : "error" });
      }
    }
    return { ok: false, reason: "unverified" };
  }

  if (id.startsWith("custom:")) {
    const cu = s.custom.find((x) => `custom:${x.id}` === id);
    if (!cu) return { ok: false, reason: "not-found" };
    return {
      ok: true,
      fromCache: false,
      station: { id, nameAr: cu.name, nameEn: cu.name, country: "—", category: "general", identity: "user-confirmed", streams: [{ url: cu.url, source: "custom" }] },
    };
  }

  const k = s.known[id];
  if (k) return { ok: true, station: k, fromCache: true };
  return { ok: false, reason: "not-found" };
}

/** When the directory is down, the last stream that came from the verified record is still usable. */
function fallbackOr(id: string, r: ResolveResult): ResolveResult {
  const k = getState().known[id];
  return k?.streams.length ? { ok: true, station: k, fromCache: true } : r;
}

export function rememberDirectoryStation(st: PlayableStation) {
  update((s) => ({ ...s, known: { ...s.known, [st.id]: st } }));
}

export function confirmBinding(catalogId: string, group: DirectoryStation[]) {
  const d = group[0]!;
  const streams = streamsFrom(group);
  if (!streams.length) return;
  const binding: Binding = {
    stream: streams[0]!,
    alternatives: streams.slice(1),
    rbUuid: d.uuid,
    directoryName: d.name,
    homepage: d.homepage || undefined,
    confirmedAt: new Date().toISOString(),
  };
  update((s) => ({ ...s, bindings: { ...s.bindings, [catalogId]: binding } }));
}

export function removeBinding(catalogId: string) {
  update((s) => {
    const b = { ...s.bindings };
    delete b[catalogId];
    return { ...s, bindings: b };
  });
}

export function displayName(v: { nameAr: string; nameEn: string; id: string }, lang: "ar" | "en", nicknames: Record<string, string>) {
  return nicknames[v.id] || (lang === "ar" ? v.nameAr : v.nameEn);
}
