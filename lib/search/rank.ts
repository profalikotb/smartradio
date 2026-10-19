import type { Category, DirectoryStation, CatalogStation } from "../types";
import { normalize, tokens, tokenScore } from "./normalize";
import type { ParsedQuery } from "./query";

export interface SearchEntry {
  key: string; // stable id: catalog id or rb:<uuid>
  source: "catalog" | "directory" | "custom";
  names: string[]; // display names + aliases
  country: string; // ISO
  category: Category;
  verified: boolean; // catalog-verified or user-confirmed identity
  core: boolean;
  lastPlaybackOkAt?: number; // epoch ms, this device
  bitrate?: number;
  language?: string;
  directory?: DirectoryStation;
  catalog?: CatalogStation;
}

export interface Filters {
  country?: string;
  category?: Category;
  language?: string;
  minBitrate?: number;
}

const DAY = 86_400_000;

/** Returns 0 when the entry does not match the text at all. */
export function textScore(q: ParsedQuery, names: string[]): number {
  if (!q.terms.length) return q.text ? 0 : 0.01;
  let best = 0;
  for (const name of names) {
    const n = normalize(name);
    if (n === q.text) return 1.5; // exact full-name/alias match
    const ct = tokens(name);
    if (!ct.length) continue;
    let sum = 0;
    let hit = 0;
    for (const qt of q.terms) {
      let m = 0;
      for (const c of ct) m = Math.max(m, tokenScore(qt, c));
      if (m > 0) hit++;
      sum += m;
    }
    if (!hit) continue;
    const coverage = hit / q.terms.length;
    const s = (sum / q.terms.length) * (0.5 + 0.5 * coverage) + (n.startsWith(q.text) ? 0.2 : 0);
    best = Math.max(best, s);
  }
  return best;
}

export function scoreEntry(q: ParsedQuery, e: SearchEntry, now = Date.now()): number {
  const t = textScore(q, e.names);
  if (t <= 0) return 0;
  let s = t * 10;
  const country = q.country;
  if (country) s += e.country === country ? 3 : -4;
  else if (e.country === "EG") s += 1.5;
  if (q.category && e.category === q.category) s += 2;
  if (e.verified) s += 2;
  if (e.core) s += 2.5; // curated core stations outrank look-alikes
  if (e.source === "catalog") s += 1;
  if (e.lastPlaybackOkAt && now - e.lastPlaybackOkAt < 30 * DAY) s += 1.5;
  if (e.directory && !e.directory.lastcheckok) s -= 2;
  return s;
}

export function passesFilters(e: SearchEntry, f: Filters): boolean {
  if (f.country && e.country !== f.country) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.language && e.language && !normalize(e.language).includes(normalize(f.language))) return false;
  if (f.minBitrate && (e.bitrate ?? 0) < f.minBitrate) return false;
  return true;
}

/** Infers a category from Radio Browser tags/name. */
export function categorize(d: Pick<DirectoryStation, "tags" | "name">): Category {
  const s = normalize(`${d.tags} ${d.name}`);
  if (/quran|koran|قران/.test(s)) return "quran";
  if (/islam|relig|christ|church|دين|اسلام/.test(s)) return "religious";
  if (/news|talk|اخبار/.test(s)) return "news";
  if (/sport|رياض/.test(s)) return "sports";
  if (/cultur|ثقاف/.test(s)) return "culture";
  if (/music|pop|hits|song|tarab|اغاني|موسيق|طرب/.test(s)) return "music";
  if (/regional|local|اقليم/.test(s)) return "regional";
  return "general";
}

/**
 * Collapse duplicate directory listings (same normalized name + country) into one entry, keeping the
 * others as alternative streams. Returns groups; the first item of each group is the representative.
 */
export function dedupe(list: DirectoryStation[]): DirectoryStation[][] {
  const groups = new Map<string, DirectoryStation[]>();
  for (const d of list) {
    const key = `${d.countrycode}|${tokens(d.name).join(" ")}|${hostOf(d.homepage)}`;
    const g = groups.get(key);
    if (!g) groups.set(key, [d]);
    else if (!g.some((x) => (x.urlResolved || x.url) === (d.urlResolved || d.url))) g.push(d);
  }
  for (const g of groups.values()) g.sort((a, b) => Number(b.lastcheckok) - Number(a.lastcheckok) || b.votes - a.votes);
  return [...groups.values()];
}

export function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
