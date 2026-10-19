/**
 * Radio Browser API client (server-side). Mirrors are discovered from the official
 * all.api.radio-browser.info server list, as the API guidelines recommend; only JSON metadata is
 * fetched here — audio never passes through the server.
 */
import type { DirectoryStation } from "../types";
import { normalize } from "../search/normalize";

const DISCOVERY = "https://all.api.radio-browser.info/json/servers";
const FALLBACK_MIRRORS = ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"];
const MIRROR_TTL = 60 * 60 * 1000;
const HOST_RE = /^[a-z0-9-]+\.api\.radio-browser\.info$/;

let mirrors: { hosts: string[]; at: number } | null = null;

function ua() {
  const contact = process.env.DIRECTORY_USER_AGENT?.slice(0, 80) || "private";
  return `ProfAliKotbSmartRadio/1.0 (${contact})`;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": ua(), Accept: "application/json" }, signal: ctrl.signal, redirect: "error", cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function getMirrors(): Promise<string[]> {
  if (mirrors && Date.now() - mirrors.at < MIRROR_TTL) return mirrors.hosts;
  try {
    const list = await fetchJson<{ name: string }[]>(DISCOVERY, 4000);
    const hosts = [...new Set(list.map((s) => s.name.toLowerCase()).filter((h) => HOST_RE.test(h)))];
    if (hosts.length) {
      // shuffle to spread load, as requested by the API guidelines
      for (let i = hosts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hosts[i], hosts[j]] = [hosts[j]!, hosts[i]!];
      }
      mirrors = { hosts, at: Date.now() };
      return hosts;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_MIRRORS;
}

export class DirectoryUnavailable extends Error {}

/** Tries up to 3 mirrors with a bounded timeout each. */
async function rb<T>(path: string): Promise<T> {
  const hosts = (await getMirrors()).slice(0, 3);
  let last: unknown;
  for (const h of hosts) {
    try {
      return await fetchJson<T>(`https://${h}${path}`, 6000);
    } catch (e) {
      last = e;
    }
  }
  throw new DirectoryUnavailable(String(last));
}

interface RawStation {
  stationuuid: string;
  name: string;
  countrycode: string;
  country: string;
  language: string;
  tags: string;
  homepage: string;
  favicon: string;
  codec: string;
  bitrate: number;
  hls: number;
  url: string;
  url_resolved: string;
  lastcheckok: number;
  lastcheckoktime_iso8601?: string;
  lastcheckoktime?: string;
  votes: number;
  clickcount: number;
}

const s = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

export function mapStation(r: RawStation): DirectoryStation {
  return {
    uuid: s(r.stationuuid, 40),
    name: s(r.name, 160).trim(),
    countrycode: s(r.countrycode, 2).toUpperCase(),
    country: s(r.country, 60),
    language: s(r.language, 80),
    tags: s(r.tags, 200),
    homepage: s(r.homepage),
    favicon: /^https:\/\//.test(r.favicon) ? s(r.favicon) : "",
    codec: s(r.codec, 20),
    bitrate: Number(r.bitrate) || 0,
    hls: r.hls === 1,
    url: s(r.url, 600),
    urlResolved: s(r.url_resolved, 600),
    lastcheckok: r.lastcheckok === 1,
    lastcheckoktime: s(r.lastcheckoktime_iso8601 ?? r.lastcheckoktime, 40),
    votes: Number(r.votes) || 0,
    clickcount: Number(r.clickcount) || 0,
  };
}

export async function byUuids(uuids: string[]): Promise<DirectoryStation[]> {
  const clean = uuids.filter((u) => /^[0-9a-f-]{36}$/i.test(u)).slice(0, 50);
  if (!clean.length) return [];
  const raw = await rb<RawStation[]>(`/json/stations/byuuid?uuids=${clean.join(",")}`);
  return raw.map(mapStation);
}

/**
 * Name search. Radio Browser matches substrings without Arabic normalization, so we send the raw
 * text plus a normalized variant (and the alef-hamza variants most Egyptian listings use) and merge.
 */
export async function searchByName(q: string, opts: { countrycode?: string; limit?: number } = {}): Promise<DirectoryStation[]> {
  const raw = q.trim().slice(0, 80);
  if (raw.length < 2) return [];
  const variants = new Set([raw, normalize(raw)]);
  const n = normalize(raw);
  if (/^ا/.test(n) || n.includes(" ا")) variants.add(n.replace(/(^| )ا/g, "$1إ"));
  if (n.includes("ه")) variants.add(n.replace(/ه( |$)/g, "ة$1"));
  const limit = Math.min(opts.limit ?? 40, 100);
  const cc = opts.countrycode && /^[A-Z]{2}$/.test(opts.countrycode) ? `&countrycode=${opts.countrycode}` : "";
  const results = await Promise.allSettled(
    [...variants].slice(0, 4).map((v) =>
      rb<RawStation[]>(`/json/stations/search?name=${encodeURIComponent(v)}${cc}&limit=${limit}&hidebroken=false&order=votes&reverse=true`),
    ),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<RawStation[]> => r.status === "fulfilled");
  if (!ok.length) throw new DirectoryUnavailable("all variants failed");
  const seen = new Map<string, DirectoryStation>();
  for (const r of ok) for (const st of r.value) if (!seen.has(st.stationuuid)) seen.set(st.stationuuid, mapStation(st));
  return [...seen.values()];
}
