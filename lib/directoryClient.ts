"use client";
import type { DirectoryStation } from "./types";

export class DirectoryError extends Error {
  constructor(public kind: "offline" | "unavailable" | "timeout" | "auth" | "error") {
    super(kind);
  }
}

const cache = new Map<string, { at: number; data: DirectoryStation[] }>();
const TTL = 5 * 60 * 1000;

async function call(params: Record<string, string>, signal?: AbortSignal, timeoutMs = 9000): Promise<DirectoryStation[]> {
  const qs = new URLSearchParams(params).toString();
  const hit = cache.get(qs);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new DirectoryError("offline");

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`/api/directory?${qs}`, { signal: ctrl.signal, credentials: "same-origin" });
    if (r.status === 401) throw new DirectoryError("auth");
    if (r.status === 503) throw new DirectoryError("unavailable");
    if (!r.ok) throw new DirectoryError("error");
    const j = (await r.json()) as { stations: DirectoryStation[] };
    cache.set(qs, { at: Date.now(), data: j.stations });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return j.stations;
  } catch (e) {
    if (e instanceof DirectoryError) throw e;
    if (signal?.aborted) throw e; // caller cancelled — propagate AbortError
    if ((e as Error).name === "AbortError") throw new DirectoryError("timeout");
    throw new DirectoryError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const directory = {
  search: (q: string, country: string | undefined, signal?: AbortSignal) => call(country ? { q, country } : { q }, signal),
  byUuids: (uuids: string[], signal?: AbortSignal) => call({ uuids: uuids.join(",") }, signal),
  byPrefixes: (prefixes: string[], signal?: AbortSignal) => call({ prefixes: prefixes.join(",") }, signal, 12000),
  candidates: (catalogId: string, signal?: AbortSignal) => call({ candidates: catalogId }, signal, 15000),
  invalidate: () => cache.clear(),
};

export async function resolvePlaylist(url: string, signal: AbortSignal): Promise<{ hls: boolean; urls: string[] }> {
  const r = await fetch(`/api/resolve-playlist?url=${encodeURIComponent(url)}`, { signal, credentials: "same-origin" });
  if (!r.ok) throw new Error("playlist");
  return (await r.json()) as { hls: boolean; urls: string[] };
}
