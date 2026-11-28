"use client";
import { useSyncExternalStore } from "react";

/**
 * «الخلافة الإسلامية في 1000 عام» — د. إبراهيم العسال مع الصحفي سيد جبيل، قناة «نعرف» (Ne3raf) على يوتيوب.
 * Played through YouTube's official player (the official playlist), so it is video, not a radio stream:
 * no background / lock-screen audio, and YouTube may show its own ads. Progress is kept per episode on this device.
 */
export const KHILAFA = {
  playlistId: "PL4-hDbT07cQB0NlnFwwWT3tfce-DjZaLI",
  playlistUrl: "https://www.youtube.com/playlist?list=PL4-hDbT07cQB0NlnFwwWT3tfce-DjZaLI",
  channelUrl: "https://www.youtube.com/@Ne3rafChannel",
};

export interface KEpisode {
  pos: number;
  dur: number;
  done?: boolean;
  at: number;
}
export interface KState {
  /** Video ids in playlist order (from the official player). */
  ids: string[];
  titles: Record<string, string>;
  eps: Record<string, KEpisode>;
  last?: { id: string; index: number; pos: number; at: number };
  newestFirst?: boolean;
}

const KEY = "smart-radio:khilafa:v1";
const EMPTY: KState = { ids: [], titles: {}, eps: {} };
let state: KState = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as KState) };
  } catch {
    /* private mode */
  }
}

export function getK(): KState {
  load();
  return state;
}

export function updateK(fn: (s: KState) => KState) {
  load();
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* full */
  }
  subs.forEach((f) => f());
}

export function useK(): KState {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    getK,
    () => EMPTY,
  );
}

/** Save the playing position of one episode (called every few seconds while playing). */
export function recordK(id: string, index: number, pos: number, dur: number, title?: string) {
  if (!id) return;
  const p = Math.max(0, Math.floor(pos));
  const d = Math.max(0, Math.floor(dur));
  const done = d > 0 && p >= d - 20;
  updateK((s) => ({
    ...s,
    titles: title && s.titles[id] !== title ? { ...s.titles, [id]: title } : s.titles,
    eps: { ...s.eps, [id]: { pos: done ? 0 : p, dur: d || s.eps[id]?.dur || 0, done: done || s.eps[id]?.done, at: Date.now() } },
    last: { id, index, pos: done ? 0 : p, at: Date.now() },
  }));
}

/** Where to resume: the saved episode (by id, so new uploads don't shift it) and second. */
export function resumePoint(s: KState): { index: number; pos: number } | null {
  if (!s.last) return null;
  const i = s.ids.indexOf(s.last.id);
  const ep = s.eps[s.last.id];
  const index = i >= 0 ? i : s.last.index;
  if (ep?.done && !ep.pos && index + 1 < (s.ids.length || Infinity)) return { index: index + 1, pos: 0 };
  return { index, pos: ep && !ep.done ? ep.pos : s.last.pos };
}

export const isYtId = (id: string) => /^[\w-]{11}$/.test(id);
