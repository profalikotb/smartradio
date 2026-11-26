"use client";
import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "../api";
import type { PlayableStation } from "../types";
import { createProgressStore, type ProgressStore } from "../tafsir/progress";
import { playTrack, registerSection } from "../ondemand";
import { registerSongNames, type Library, type Song, type Version } from "./parse";
import { myFilesStation } from "./local";
import { player } from "../player/controller";
import { ARTISTS, type Artist, type ArtistSlug } from "./artists";

type LibState = { status: "idle" | "loading" | "ready" | "error"; library?: Library; stale?: boolean };

export interface ArtistClient {
  artist: Artist;
  store: ProgressStore;
  allId: string;
  myId: string;
  loadLibrary(force?: boolean): void;
  useLibrary(): LibState;
  getLibrary(): Library | undefined;
  songStation(song: Song): PlayableStation;
  continuousStation(lib: Library): PlayableStation | null;
  playVersion(station: PlayableStation, index: number, opts?: { fromStart?: boolean; at?: number }): void;
  songByKey(lib: Library, key: string): Song | undefined;
  /** Continue the last listening of this artist at the exact second. */
  continueLast(lib: Library | undefined): boolean;
}

function createArtistClient(artist: Artist): ArtistClient {
  const store = createProgressStore(artist.storeKeys[0], artist.storeKeys[1]);
  const allId = `${artist.prefix}all`;
  const myId = `${artist.prefix}my`;

  // ---------- library (fetched once, cached on the device) ----------
  let ls: LibState = { status: "idle" };
  const listeners = new Set<() => void>();
  const setLs = (n: LibState) => {
    ls = n;
    if (n.library) registerSongNames(n.library, artist.prefix);
    for (const l of listeners) l();
  };
  const loadLibrary = (force = false) => {
    if (typeof window === "undefined") return;
    if (!force && (ls.status === "loading" || (ls.status === "ready" && !ls.stale))) return;
    if (!ls.library) {
      try {
        const cached = localStorage.getItem(artist.libKey);
        if (cached) setLs({ status: "ready", library: JSON.parse(cached) as Library, stale: true });
      } catch {
        /* ignore */
      }
    }
    if (!ls.library) setLs({ status: "loading" });
    apiFetch(artist.api)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const lib = (await r.json()) as Library;
        setLs({ status: "ready", library: lib });
        try {
          localStorage.setItem(artist.libKey, JSON.stringify(lib));
        } catch {
          /* full */
        }
      })
      .catch(() => setLs(ls.library ? { ...ls, stale: true } : { status: "error" }));
  };
  function useLibrary(): LibState {
    const s = useSyncExternalStore(
      (l) => (listeners.add(l), () => listeners.delete(l)),
      () => ls,
      () => ls,
    );
    useEffect(() => loadLibrary(), []);
    return s;
  }

  // ---------- stations ----------
  const toStation = (id: string, nameAr: string, nameEn: string, versions: Version[]): PlayableStation => ({
    id,
    nameAr,
    nameEn,
    country: "EG",
    category: "music",
    identity: "unverified",
    playlist: true,
    onDemand: true,
    streams: versions.map((v) => ({ url: v.audioUrl, id: v.id, seconds: v.duration || undefined, label: v.title, source: "playlist" as const, codec: "MP3" })),
  });
  const songStation = (song: Song) => toStation(`${artist.prefix}s:${song.key}`, `${artist.nameAr} – ${song.title}`, `${artist.nameEn} — ${song.title}`, song.versions);

  /** One version per song (studio preferred), shuffled like a radio. Kept stable for the session. */
  let shuffled: { lib: Library; order: Version[] } | null = null;
  const continuousStation = (lib: Library): PlayableStation | null => {
    if (!shuffled || shuffled.lib !== lib) {
      const pick = lib.songs.map((s) => s.versions[0]).filter((v): v is Version => !!v);
      for (let i = pick.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pick[i], pick[j]] = [pick[j]!, pick[i]!];
      }
      shuffled = { lib, order: pick };
    }
    return shuffled.order.length ? { ...toStation(allId, `${artist.nameAr} – الاستماع المتصل`, `${artist.nameEn} — continuous`, shuffled.order), loop: true } : null;
  };

  const songKeyOf = (station: PlayableStation, index: number): string | undefined => {
    if (station.id.startsWith(`${artist.prefix}s:`)) return station.id.slice(artist.prefix.length + 2);
    const id = station.streams[index]?.id;
    return id ? ls.library?.songs.find((s) => s.versions.some((v) => v.id === id))?.key : undefined;
  };

  const section = {
    prefix: artist.prefix,
    store,
    lastOf: (st: PlayableStation, index: number, pos: number) => {
      const ep = st.streams[index];
      return ep?.id ? { stationId: st.id, surah: 0, key: songKeyOf(st, index), episodeId: ep.id, index, pos: Math.floor(pos), at: Date.now() } : null;
    },
  };
  registerSection(section);

  const playVersion = (station: PlayableStation, index: number, opts: { fromStart?: boolean; at?: number } = {}) => playTrack(section, station, index, opts);
  const songByKey = (lib: Library, key: string) => lib.songs.find((s) => s.key === key);

  const continueLast = (lib: Library | undefined): boolean => {
    const p = store.get();
    const last = p.last;
    if (!last) return false;
    if (last.stationId === myId) {
      // Files live in this browser's storage: unlock audio inside the tap, then load them.
      player().engine.unlock();
      void myFilesStation(artist.slug).then((st) => {
        if (!st) return;
        let index = st.streams.findIndex((s) => s.id === last.episodeId);
        if (index < 0) index = 0;
        const saved = store.get().episodes[last.episodeId];
        playVersion(st, index, { at: saved && !saved.done ? saved.pos : 0 });
      });
      return true;
    }
    if (!lib) return false;
    let station: PlayableStation | null = null;
    if (last.stationId === allId) station = continuousStation(lib);
    else {
      const song = last.key ? songByKey(lib, last.key) : undefined;
      station = song ? songStation(song) : null;
    }
    if (!station) return false;
    let index = station.streams.findIndex((s) => s.id === last.episodeId);
    if (index < 0) {
      if (last.stationId === allId) return false;
      index = Math.min(last.index, station.streams.length - 1);
    }
    const saved = p.episodes[last.episodeId];
    playVersion(station, index, { at: saved && !saved.done ? saved.pos : last.pos });
    return true;
  };

  return { artist, store, allId, myId, loadLibrary, useLibrary, getLibrary: () => ls.library, songStation, continuousStation, playVersion, songByKey, continueLast };
}

export const CLIENTS: Record<ArtistSlug, ArtistClient> = {
  umm: createArtistClient(ARTISTS.umm),
  halim: createArtistClient(ARTISTS.halim),
};
export const clientFor = (slug: ArtistSlug) => CLIENTS[slug];

// ---------- Umm Kulthum names kept for existing imports ----------
const U = CLIENTS.umm;
export const UMM_PREFIX = ARTISTS.umm.prefix;
export const UMM_ALL_ID = U.allId;
export const UMM_LIVE_ID = ARTISTS.umm.liveId;
export const ummStore = U.store;
export const loadLibrary = U.loadLibrary;
export const useLibrary = U.useLibrary;
export const getLibrary = U.getLibrary;
export const songStation = U.songStation;
export const continuousStation = U.continuousStation;
export const playVersion = U.playVersion;
export const songByKey = U.songByKey;
export const continueUmm = U.continueLast;
