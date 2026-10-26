"use client";
import { useSyncExternalStore } from "react";
import type { RepeatMode } from "../player/engine";

/**
 * Listening progress for Tafsir Al-Sha'rawi — per episode, plus "where I stopped".
 *
 * Storage: IndexedDB (durable) mirrored to localStorage (synchronous, survives a tab being killed
 * mid-write). On load, whichever copy has the newer savedAt wins, so a failure in either store is
 * recovered from the other. Everything stays on this device.
 */

export interface EpisodeProgress {
  pos: number; // seconds
  dur: number; // seconds (0 = unknown)
  at: number; // last listened, epoch ms
  done: boolean;
  /** Last time this episode actually played on this device (epoch ms) — real playback verification. */
  okAt?: number;
  /** Last playback failure on this device. */
  failAt?: number;
}

export interface LastListen {
  stationId: string; // "tafsir:<surah>" or "tafsir:all"
  surah: number;
  episodeId: string;
  index: number;
  pos: number;
  at: number;
}

export interface TafsirProgress {
  v: 1;
  savedAt: number;
  episodes: Record<string, EpisodeProgress>;
  last?: LastListen;
  lastSurah?: number;
  rate: number;
  repeat: RepeatMode;
  favSurahs: number[];
  recentSurahs: number[]; // most recent first
}

export const EMPTY: TafsirProgress = { v: 1, savedAt: 0, episodes: {}, rate: 1, repeat: "off", favSurahs: [], recentSurahs: [] };
export const RATES = [0.75, 1, 1.25, 1.5] as const;
/** An episode counts as completed when it ended, or when less than this is left. */
const DONE_TAIL_S = 20;

// ---------- pure reducers (unit-tested) ----------
export function recordPosition(p: TafsirProgress, id: string, pos: number, dur: number, at = Date.now()): TafsirProgress {
  const prev = p.episodes[id];
  const d = dur > 0 ? dur : prev?.dur ?? 0;
  const done = (prev?.done ?? false) || (d > 0 && pos >= d - DONE_TAIL_S);
  return { ...p, episodes: { ...p.episodes, [id]: { ...prev, pos: Math.max(0, Math.floor(pos)), dur: Math.floor(d), at, done } } };
}

export function markDone(p: TafsirProgress, id: string, at = Date.now()): TafsirProgress {
  const prev = p.episodes[id];
  return { ...p, episodes: { ...p.episodes, [id]: { pos: 0, dur: prev?.dur ?? 0, at, done: true, okAt: prev?.okAt ?? at } } };
}

export function markPlayback(p: TafsirProgress, id: string, ok: boolean, at = Date.now()): TafsirProgress {
  const prev = p.episodes[id] ?? { pos: 0, dur: 0, at, done: false };
  return { ...p, episodes: { ...p.episodes, [id]: ok ? { ...prev, okAt: at, failAt: undefined } : { ...prev, failAt: at } } };
}

export function setLast(p: TafsirProgress, last: LastListen): TafsirProgress {
  const recent = [last.surah, ...p.recentSurahs.filter((n) => n !== last.surah)].filter((n) => n > 0).slice(0, 12);
  return { ...p, last, lastSurah: last.surah > 0 ? last.surah : p.lastSurah, recentSurahs: recent };
}

export function toggleFavSurah(p: TafsirProgress, n: number): TafsirProgress {
  return { ...p, favSurahs: p.favSurahs.includes(n) ? p.favSurahs.filter((x) => x !== n) : [...p.favSurahs, n].sort((a, b) => a - b) };
}

/** Where to start an episode: its saved second, unless it was finished (or nearly). */
export function resumePosition(p: TafsirProgress, id: string): number {
  const e = p.episodes[id];
  if (!e || e.done) return 0;
  if (e.dur > 0 && e.pos >= e.dur - DONE_TAIL_S) return 0;
  return e.pos > 3 ? e.pos : 0;
}

export function surahStats(p: TafsirProgress, ids: string[]): { done: number; total: number; percent: number; started: boolean } {
  const total = ids.length;
  let done = 0;
  let weighted = 0;
  let started = false;
  for (const id of ids) {
    const e = p.episodes[id];
    if (!e) continue;
    started = true;
    if (e.done) {
      done++;
      weighted += 1;
    } else if (e.dur > 0) weighted += Math.min(1, e.pos / e.dur);
  }
  return { done, total, percent: total ? Math.round((weighted / total) * 100) : 0, started };
}

/** Defensive parse of stored data (old/corrupt never crashes). */
export function sanitize(raw: unknown): TafsirProgress {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Partial<TafsirProgress>;
  const episodes: Record<string, EpisodeProgress> = {};
  if (r.episodes && typeof r.episodes === "object")
    for (const [k, e] of Object.entries(r.episodes))
      if (e && typeof e.pos === "number" && Number.isFinite(e.pos)) episodes[k] = { pos: e.pos, dur: Number(e.dur) || 0, at: Number(e.at) || 0, done: !!e.done, okAt: e.okAt, failAt: e.failAt };
  const nums = (a: unknown) => (Array.isArray(a) ? a.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 114) : []);
  const last = r.last && typeof r.last.episodeId === "string" && typeof r.last.stationId === "string" ? r.last : undefined;
  return {
    v: 1,
    savedAt: Number(r.savedAt) || 0,
    episodes,
    last,
    lastSurah: Number.isInteger(r.lastSurah) ? r.lastSurah : undefined,
    rate: (RATES as readonly number[]).includes(Number(r.rate)) ? Number(r.rate) : 1,
    repeat: r.repeat === "one" || r.repeat === "all" ? r.repeat : "off",
    favSurahs: nums(r.favSurahs),
    recentSurahs: nums(r.recentSurahs),
  };
}

// ---------- store ----------
const LS_KEY = "smart-radio:tafsir-progress:v1";
const DB = "smart-radio";
const STORE = "kv";

let state: TafsirProgress = { ...EMPTY };
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(): Promise<unknown> {
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get("tafsir-progress");
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(v: TafsirProgress): Promise<void> {
  const db = await idb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(v, "tafsir-progress");
  } catch {
    /* quota / private mode: the localStorage mirror still has it */
  }
}

function lsGet(): unknown {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function lsPut(v: TafsirProgress) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* full or blocked */
  }
}

/** Load once (sync from localStorage, then reconcile with IndexedDB). Safe to call repeatedly. */
export function loadProgress() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = sanitize(lsGet());
  emit();
  void idbGet().then((raw) => {
    if (!raw) return;
    const fromDb = sanitize(raw);
    if (fromDb.savedAt > state.savedAt) {
      state = fromDb;
      lsPut(state);
      emit();
    }
  });
  const flush = () => saveNow();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

export function getProgress(): TafsirProgress {
  loadProgress();
  return state;
}

export function updateProgress(fn: (p: TafsirProgress) => TafsirProgress, immediate = false) {
  loadProgress();
  state = { ...fn(state), savedAt: Date.now() };
  emit();
  if (immediate) return saveNow();
  if (!saveTimer) saveTimer = setTimeout(saveNow, 1500);
}

export function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!loaded) return;
  lsPut(state);
  void idbPut(state);
}

export function useProgress<T>(sel: (p: TafsirProgress) => T): T {
  return useSyncExternalStore(
    (l) => {
      loadProgress();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
    () => sel(EMPTY),
  );
}

/** For tests. */
export function __resetProgress(p: TafsirProgress = { ...EMPTY }) {
  state = p;
  loaded = true;
}
