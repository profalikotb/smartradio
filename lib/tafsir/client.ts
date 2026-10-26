"use client";
import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "../api";
import { player } from "../player/controller";
import type { PlayableStation } from "../types";
import type { Episode, Manifest } from "./parse";
import { surahName } from "./parse";
import { getProgress, markDone, markPlayback, recordPosition, resumePosition, saveNow, setLast, updateProgress } from "./progress";

/** Station ids used by the shared player for Tafsir playback. */
export const TAFSIR_PREFIX = "tafsir:";
export const CONTINUOUS_ID = "tafsir:all";
/** The live Sheikh Al-Sha'rawi radio from the station list (a real live stream, not recordings). */
export const SHARAWY_LIVE_ID = "sharawy";

// ---------- manifest (fetched once, cached on the device for offline browsing) ----------
type ManifestState = { status: "idle" | "loading" | "ready" | "error"; manifest?: Manifest; stale?: boolean };
const LS_KEY = "smart-radio:tafsir-manifest:v1";
let ms: ManifestState = { status: "idle" };
const mListeners = new Set<() => void>();
function setMs(n: ManifestState) {
  ms = n;
  for (const l of mListeners) l();
}

export function loadManifest(force = false) {
  if (typeof window === "undefined") return;
  if (!force && (ms.status === "loading" || (ms.status === "ready" && !ms.stale))) return;
  if (!ms.manifest) {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setMs({ status: "ready", manifest: JSON.parse(cached) as Manifest, stale: true });
    } catch {
      /* ignore */
    }
  }
  if (!ms.manifest) setMs({ status: "loading" });
  apiFetch("/api/tafsir")
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const m = (await r.json()) as Manifest;
      setMs({ status: "ready", manifest: m });
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(m));
      } catch {
        /* full */
      }
    })
    .catch(() => setMs(ms.manifest ? { ...ms, stale: true } : { status: "error" }));
}

export function useManifest(): ManifestState {
  const s = useSyncExternalStore(
    (l) => (mListeners.add(l), () => mListeners.delete(l)),
    () => ms,
    () => ms,
  );
  useEffect(() => loadManifest(), []);
  return s;
}

export function getManifest(): Manifest | undefined {
  return ms.manifest;
}

/** All episodes in reading order (surah 1 → 114), for continuous listening. */
export function allEpisodes(m: Manifest): Episode[] {
  const out: Episode[] = [];
  const seen = new Set<string>();
  for (let n = 1; n <= 114; n++)
    for (const e of m.surahs[n] ?? []) {
      if (seen.has(e.id)) continue; // multi-surah fallback files appear under several surahs
      seen.add(e.id);
      out.push(e);
    }
  return out;
}

// ---------- building player stations ----------
function toStation(id: string, nameAr: string, nameEn: string, eps: Episode[]): PlayableStation {
  return {
    id,
    nameAr,
    nameEn,
    country: "EG",
    category: "religious",
    identity: "unverified",
    playlist: true,
    onDemand: true,
    streams: eps.map((e) => ({ url: e.audioUrl, id: e.id, seconds: e.duration || undefined, label: e.title, source: "playlist" as const, codec: "MP3" })),
  };
}

export function surahStation(m: Manifest, n: number): PlayableStation | null {
  const eps = n === 0 ? m.intro : m.surahs[n];
  if (!eps?.length) return null;
  return toStation(`${TAFSIR_PREFIX}${n}`, `تفسير الشعراوي – سورة ${surahName(n)}`, `Al-Sha'rawi Tafsir — Surah ${n}`, eps);
}

export function continuousStation(m: Manifest): PlayableStation | null {
  const eps = allEpisodes(m);
  return eps.length ? toStation(CONTINUOUS_ID, "تفسير الشعراوي – الاستماع المتصل", "Al-Sha'rawi Tafsir — continuous", eps) : null;
}

export function isTafsir(id?: string): boolean {
  return !!id && id.startsWith(TAFSIR_PREFIX);
}


// ---------- playback ----------
/**
 * Play an episode (from a tap). Starts at the episode's saved second unless fromStart.
 * Any radio station that was playing stops: there is only one audio element.
 */
export function playEpisode(station: PlayableStation, index: number, opts: { fromStart?: boolean; at?: number } = {}) {
  const p = getProgress();
  const ep = station.streams[index];
  if (!ep?.id) return;
  const at = opts.fromStart ? 0 : opts.at ?? resumePosition(p, ep.id);
  const e = player().engine;
  e.setRate(p.rate);
  e.setRepeat(p.repeat);
  player().playPrepared(station, { index, at });
  noteLast(station, index, at, true);
}

/** Continue exactly where the last tafsir listening stopped. */
export function continueLast(m: Manifest): boolean {
  const last = getProgress().last;
  if (!last) return false;
  const station = last.stationId === CONTINUOUS_ID ? continuousStation(m) : surahStation(m, last.surah);
  if (!station) return false;
  let index = station.streams.findIndex((s) => s.id === last.episodeId);
  if (index < 0) index = Math.min(last.index, station.streams.length - 1);
  const saved = getProgress().episodes[last.episodeId];
  playEpisode(station, index, { at: saved && !saved.done ? saved.pos : last.pos });
  return true;
}

function surahOf(station: PlayableStation, index: number): number {
  const id = station.streams[index]?.id ?? "";
  const n = Number(/\/(\d{1,3})[_\s.-]/.exec(id)?.[1]);
  if (station.id !== CONTINUOUS_ID) return Number(station.id.slice(TAFSIR_PREFIX.length));
  return Number.isFinite(n) ? n : 0;
}

function noteLast(station: PlayableStation, index: number, pos: number, immediate = false) {
  const ep = station.streams[index];
  if (!ep?.id) return;
  updateProgress((p) => setLast(p, { stationId: station.id, surah: surahOf(station, index), episodeId: ep.id!, index, pos: Math.floor(pos), at: Date.now() }), immediate);
}

// ---------- engine hooks (installed once) ----------
let wired = false;
/** Saves position every few seconds while playing, on pause, on episode change and when hidden. */
export function wireTafsirProgress() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  const e = player().engine;
  let lastKey = "";
  let lastSavedPos = -1;
  let lastStatus = "";
  e.subscribe(() => {
    const s = e.getSnapshot();
    const st = s.station;
    if (!st?.onDemand || !isTafsir(st.id)) {
      lastKey = "";
      return;
    }
    const ep = st.streams[s.streamIndex];
    if (!ep?.id) return;
    const key = `${st.id}|${s.streamIndex}`;
    const changed = key !== lastKey;
    const statusChanged = s.status !== lastStatus;
    if (changed) {
      lastKey = key;
      lastSavedPos = -1;
      noteLast(st, s.streamIndex, s.position, true);
    }
    if (statusChanged && s.status === "playing") updateProgress((p) => markPlayback(p, ep.id!, true));
    if (statusChanged && s.status === "unavailable") updateProgress((p) => markPlayback(p, ep.id!, false), true);
    const playing = s.status === "playing";
    const paused = statusChanged && (s.status === "paused" || s.status === "completed");
    if ((playing && Math.abs(s.position - lastSavedPos) >= 5) || paused) {
      lastSavedPos = s.position;
      updateProgress((p) => {
        let n = recordPosition(p, ep.id!, s.position, s.duration || ep.seconds || 0);
        n = setLast(n, { stationId: st.id, surah: surahOf(st, s.streamIndex), episodeId: ep.id!, index: s.streamIndex, pos: s.position, at: Date.now() });
        return n;
      }, paused);
    }
    lastStatus = s.status;
  });
  player().setTafsirHooks({
    startPositionFor: (station, index) => {
      const id = station.streams[index]?.id;
      return id && isTafsir(station.id) ? resumePosition(getProgress(), id) : undefined;
    },
    onTrackEnded: (station, index) => {
      const id = station.streams[index]?.id;
      if (id && isTafsir(station.id)) updateProgress((p) => markDone(p, id), true);
    },
  });
  window.addEventListener("pagehide", saveNow);
}
