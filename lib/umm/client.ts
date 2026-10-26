"use client";
import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "../api";
import type { PlayableStation } from "../types";
import { createProgressStore } from "../tafsir/progress";
import { playTrack, registerSection } from "../ondemand";
import { registerSongNames, type Library, type Song, type Version } from "./parse";

export const UMM_PREFIX = "umm:";
export const UMM_ALL_ID = "umm:all";
/** Live Umm Kulthum radio (Excel row, Show = Section): found in the radio directory at play time. */
export const UMM_LIVE_ID = "umm-kulthum";

/** Listening progress for Umm Kulthum — separate from Tafsir, same storage guarantees. */
export const ummStore = createProgressStore("smart-radio:umm-progress:v1", "umm-progress");

// ---------- library (fetched once, cached on the device) ----------
type LibState = { status: "idle" | "loading" | "ready" | "error"; library?: Library; stale?: boolean };
const LS_KEY = "smart-radio:umm-library:v1";
let ls: LibState = { status: "idle" };
const listeners = new Set<() => void>();
function setLs(n: LibState) {
  ls = n;
  if (n.library) registerSongNames(n.library);
  for (const l of listeners) l();
}

export function loadLibrary(force = false) {
  if (typeof window === "undefined") return;
  if (!force && (ls.status === "loading" || (ls.status === "ready" && !ls.stale))) return;
  if (!ls.library) {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setLs({ status: "ready", library: JSON.parse(cached) as Library, stale: true });
    } catch {
      /* ignore */
    }
  }
  if (!ls.library) setLs({ status: "loading" });
  apiFetch("/api/umm")
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const lib = (await r.json()) as Library;
      setLs({ status: "ready", library: lib });
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(lib));
      } catch {
        /* full */
      }
    })
    .catch(() => setLs(ls.library ? { ...ls, stale: true } : { status: "error" }));
}

export function useLibrary(): LibState {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => ls,
    () => ls,
  );
  useEffect(() => loadLibrary(), []);
  return s;
}

export function getLibrary(): Library | undefined {
  return ls.library;
}

// ---------- stations ----------
function toStation(id: string, nameAr: string, nameEn: string, versions: Version[]): PlayableStation {
  return {
    id,
    nameAr,
    nameEn,
    country: "EG",
    category: "music",
    identity: "unverified",
    playlist: true,
    onDemand: true,
    streams: versions.map((v) => ({ url: v.audioUrl, id: v.id, seconds: v.duration || undefined, label: v.title, source: "playlist" as const, codec: "MP3" })),
  };
}

export function songStation(song: Song): PlayableStation {
  return toStation(`${UMM_PREFIX}s:${song.key}`, `أم كلثوم – ${song.title}`, `Umm Kulthum — ${song.title}`, song.versions);
}

/** One version per song (studio preferred), shuffled like a radio. Kept stable for the session. */
let shuffled: { lib: Library; order: Version[] } | null = null;
export function continuousStation(lib: Library): PlayableStation | null {
  if (!shuffled || shuffled.lib !== lib) {
    const pick = lib.songs.map((s) => s.versions[0]).filter((v): v is Version => !!v);
    for (let i = pick.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pick[i], pick[j]] = [pick[j]!, pick[i]!];
    }
    shuffled = { lib, order: pick };
  }
  return shuffled.order.length ? { ...toStation(UMM_ALL_ID, "أم كلثوم – الاستماع المتصل", "Umm Kulthum — continuous", shuffled.order), loop: true } : null;
}

function songKeyOf(station: PlayableStation, index: number): string | undefined {
  if (station.id.startsWith(`${UMM_PREFIX}s:`)) return station.id.slice(UMM_PREFIX.length + 2);
  const id = station.streams[index]?.id;
  return id ? ls.library?.songs.find((s) => s.versions.some((v) => v.id === id))?.key : undefined;
}

const SECTION = {
  prefix: UMM_PREFIX,
  store: ummStore,
  lastOf: (st: PlayableStation, index: number, pos: number) => {
    const ep = st.streams[index];
    return ep?.id ? { stationId: st.id, surah: 0, key: songKeyOf(st, index), episodeId: ep.id, index, pos: Math.floor(pos), at: Date.now() } : null;
  },
};
registerSection(SECTION);

export function playVersion(station: PlayableStation, index: number, opts: { fromStart?: boolean; at?: number } = {}) {
  playTrack(SECTION, station, index, opts);
}

export function songByKey(lib: Library, key: string): Song | undefined {
  return lib.songs.find((s) => s.key === key);
}

/** Continue the last Umm Kulthum listening at the exact second. */
export function continueUmm(lib: Library): boolean {
  const p = ummStore.get();
  const last = p.last;
  if (!last) return false;
  let station: PlayableStation | null = null;
  if (last.stationId === UMM_ALL_ID) {
    station = continuousStation(lib);
  } else {
    const song = last.key ? songByKey(lib, last.key) : undefined;
    station = song ? songStation(song) : null;
  }
  if (!station) return false;
  let index = station.streams.findIndex((s) => s.id === last.episodeId);
  if (index < 0) {
    if (last.stationId === UMM_ALL_ID) return false;
    index = Math.min(last.index, station.streams.length - 1);
  }
  const saved = p.episodes[last.episodeId];
  playVersion(station, index, { at: saved && !saved.done ? saved.pos : last.pos });
  return true;
}
