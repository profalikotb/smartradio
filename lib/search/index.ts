import { CATALOG, LISTED } from "../catalog";
import type { AppState } from "../state";
import type { DirectoryStation } from "../types";
import { parseQuery } from "./query";
import { categorize, dedupe, passesFilters, scoreEntry, type Filters, type SearchEntry } from "./rank";

export interface SearchResult {
  entry: SearchEntry;
  score: number;
  group?: DirectoryStation[]; // directory listing + its alternative streams
}

export function catalogEntries(s: Pick<AppState, "bindings" | "playback" | "custom" | "nicknames">): SearchEntry[] {
  const out: SearchEntry[] = LISTED.map((c) => ({
    key: c.id,
    source: "catalog" as const,
    names: [c.nameAr, c.nameEn, ...c.aliases, ...(s.nicknames[c.id] ? [s.nicknames[c.id]!] : [])],
    country: c.country,
    category: c.category,
    verified: c.identity.status === "catalog-verified" || !!s.bindings[c.id],
    core: !!c.core,
    lastPlaybackOkAt: s.playback[c.id]?.lastOkAt,
    catalog: c,
  }));
  for (const cu of s.custom)
    out.push({
      key: `custom:${cu.id}`,
      source: "custom",
      names: [cu.name, ...(s.nicknames[`custom:${cu.id}`] ? [s.nicknames[`custom:${cu.id}`]!] : [])],
      country: "",
      category: "general",
      verified: true,
      core: false,
      lastPlaybackOkAt: s.playback[`custom:${cu.id}`]?.lastOkAt,
    });
  return out;
}

/**
 * Merges the curated catalog and live directory results into one ranked list.
 * Directory records that ARE a catalog station (same verified UUID or the user's confirmed binding)
 * are folded into the catalog entry instead of appearing twice.
 */
const MAX_DIRECTORY = 20;

/** Same stream regardless of http/https, letter case of the host, or a trailing "/" or ";". */
export function streamKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.port && u.port !== "80" && u.port !== "443" ? ":" + u.port : ""}${u.pathname.replace(/[/;]+$/, "")}`;
  } catch {
    return url;
  }
}

export function runSearch(
  raw: string,
  filters: Filters,
  s: Pick<AppState, "bindings" | "playback" | "custom" | "nicknames"> & Partial<Pick<AppState, "streamOverrides">>,
  directoryList: DirectoryStation[],
  now = Date.now(),
): SearchResult[] {
  const q = parseQuery(raw);
  const effective: Filters = { ...filters };
  const ownUuids = new Set<string>();
  const ownPrefixes: string[] = [];
  for (const c of CATALOG) {
    if (c.radioBrowserUuid) ownUuids.add(c.radioBrowserUuid);
    for (const p of c.rbUuidPrefixes ?? []) ownPrefixes.push(p.toLowerCase());
  }
  for (const b of Object.values(s.bindings)) ownUuids.add(b.rbUuid);
  // Directory listings that use the same stream as an Excel station are that station: fold them.
  const ownStreams = new Set<string>();
  for (const c of CATALOG) for (const d of c.directStreams ?? []) ownStreams.add(streamKey(d.url));
  for (const u of Object.values(s.streamOverrides ?? {})) ownStreams.add(streamKey(u));
  const isOwnRec = (d: DirectoryStation) =>
    ownUuids.has(d.uuid) || ownPrefixes.some((p) => d.uuid.toLowerCase().startsWith(p)) || ownStreams.has(streamKey(d.urlResolved || d.url));

  const results: SearchResult[] = [];
  for (const e of catalogEntries(s)) {
    if (!passesFilters(e, effective)) continue;
    const score = scoreEntry(q, e, now);
    if (score > 0) results.push({ entry: e, score });
  }

  const groups = dedupe(directoryList.filter((d) => !isOwnRec(d) && (d.urlResolved || d.url)));
  const dirResults: SearchResult[] = [];
  for (const g of groups) {
    const d = g[0]!;
    const key = `rb:${d.uuid}`;
    const e: SearchEntry = {
      key,
      source: "directory",
      names: [d.name, ...(s.nicknames[key] ? [s.nicknames[key]!] : [])],
      country: d.countrycode,
      category: categorize(d),
      verified: false,
      core: false,
      lastPlaybackOkAt: s.playback[key]?.lastOkAt,
      bitrate: Math.max(...g.map((x) => x.bitrate || 0)),
      language: d.language,
      directory: d,
    };
    if (!passesFilters(e, effective)) continue;
    // Directory entries must match the query text themselves (no score floor), and are capped so
    // a broad query can't bury the catalog under dozens of near-identical listings.
    const score = scoreEntry(q, e, now);
    if (score > 0) dirResults.push({ entry: e, score, group: g });
  }
  results.push(...dirResults.sort((a, b) => b.score - a.score).slice(0, MAX_DIRECTORY));

  return results.sort((a, b) => b.score - a.score).slice(0, 60);
}
