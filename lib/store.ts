"use client";
import { useSyncExternalStore } from "react";
import { emptyState, hydrate, type AppState } from "./state";

const KEY = "sr.state.v1";
const BACKUP_KEY = "sr.state.corrupt-backup";

let state: AppState = emptyState();
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / quota — state stays in memory for this session */
  }
}

export function loadStore() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const raw = safeGet(KEY);
  if (raw) {
    try {
      JSON.parse(raw);
    } catch {
      safeSet(BACKUP_KEY, raw); // never silently destroy unreadable user data
    }
  }
  state = hydrate(raw);
  persistNow();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      state = hydrate(e.newValue);
      emit();
    }
  });
  emit();
}

function persistNow() {
  safeSet(KEY, JSON.stringify(state));
}

function emit() {
  for (const l of listeners) l();
}

export function getState(): AppState {
  return state;
}

export function update(fn: (s: AppState) => AppState) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  emit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

export function replaceState(next: AppState) {
  state = next;
  emit();
  persistNow();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = emptyState();
export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(serverSnapshot),
  );
}

export function isLoaded() {
  return loaded;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persistNow);
}
