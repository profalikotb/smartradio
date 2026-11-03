"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { PlayableStation } from "../types";
import { identify } from "./parse";
import { sniff } from "./sniff";

/**
 * «ملفاتي»: audio files the user adds from their own device (MP3, M4A/AAC, FLAC, WAV…).
 * Stored only in this browser's IndexedDB — never uploaded to GitHub, Vercel or anywhere else —
 * so they are private and play offline. Nothing here is shared with other visitors of the app.
 */

export interface LocalFile {
  id: string;
  name: string; // original file name
  title: string; // display title (Arabic song title when recognised)
  size: number;
  type: string;
  duration: number; // seconds (0 = unknown)
  addedAt: number;
  /** Real format from the file's content (e.g. a RealAudio file named .mp3). */
  format?: string;
  playable?: boolean;
}

interface Row extends LocalFile {
  blob: Blob;
}

export const MY_FILES_ID = "umm:my";
const DB = "smart-radio-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error ?? r.error);
        t.onabort = () => reject(t.error ?? new Error("aborted"));
      }),
  );
}

// ---------- state ----------
type FilesState = { status: "idle" | "loading" | "ready" | "error"; files: LocalFile[]; busy?: string; error?: string };
let st: FilesState = { status: "idle", files: [] };
const listeners = new Set<() => void>();
function set(p: Partial<FilesState>) {
  st = { ...st, ...p };
  for (const l of listeners) l();
}

export async function refreshFiles() {
  if (typeof indexedDB === "undefined") return set({ status: "error", error: "unsupported" });
  if (st.status === "idle") set({ status: "loading" });
  try {
    const rows = await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>);
    // Files added before format detection existed: detect now (reads only the first bytes).
    for (const r of rows)
      if (!r.format) {
        const x = await sniff(r.blob);
        r.format = x.format;
        r.playable = x.playable;
      }
    const files = rows.map(({ blob: _b, ...f }) => f).sort((a, b) => a.title.localeCompare(b.title, "ar"));
    set({ status: "ready", files });
  } catch {
    set({ status: "error", error: "storage" });
  }
}

export function useMyFiles(): FilesState {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => st,
    () => st,
  );
  useEffect(() => {
    if (st.status === "idle") void refreshFiles();
  }, []);
  return s;
}

/** Recognise the song (same rules as the online library); otherwise the file name. */
export function titleFor(fileName: string): string {
  const id = identify({ name: fileName.replace(/\.[a-z0-9]{2,5}$/i, ".mp3"), source: "original" }, new Map());
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();
  if (!id || !id.arabic) return base; // unrecognised: keep the user's own file name
  return id.detail ? `${id.song} — ${id.detail}` : id.song;
}

function durationOf(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : 0);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    a.src = url;
  });
}

const AUDIO_EXT = /\.(mp3|m4a|aac|flac|wav|ogg|oga|opus|alac|aif|aiff)$/i;

/** Add files picked by the user. Returns how many were added / skipped (not audio). */
export async function addFiles(list: FileList | File[]): Promise<{ added: number; skipped: number }> {
  const files = [...list];
  let added = 0;
  let skipped = 0;
  // Ask the browser not to evict our storage under pressure (granted silently on most devices).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* optional */
  }
  for (const [i, f] of files.entries()) {
    if (!(f.type.startsWith("audio/") || AUDIO_EXT.test(f.name))) {
      skipped++;
      continue;
    }
    set({ busy: `${i + 1}/${files.length}` });
    const x = await sniff(f);
    // Store with the true MIME type: Safari/Firefox refuse blob audio whose type is wrong or empty.
    const blob = x.playable ? new Blob([f], { type: x.mime }) : f;
    const row: Row = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      title: titleFor(f.name),
      size: f.size,
      type: x.playable ? x.mime : f.type || x.mime,
      duration: x.playable ? await durationOf(blob) : 0,
      addedAt: Date.now(),
      format: x.format,
      playable: x.playable,
      blob,
    };
    try {
      await tx("readwrite", (s) => s.put(row));
      added++;
    } catch {
      set({ busy: undefined, error: "quota" });
      break;
    }
  }
  set({ busy: undefined });
  await refreshFiles();
  return { added, skipped };
}

export async function removeFile(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  await refreshFiles();
}

export async function renameFile(id: string, title: string) {
  const row = await tx<Row | undefined>("readonly", (s) => s.get(id) as IDBRequest<Row | undefined>);
  if (!row) return;
  await tx("readwrite", (s) => s.put({ ...row, title: title.trim().slice(0, 120) || row.title }));
  await refreshFiles();
}

// ---------- playback ----------
const urls = new Map<string, string>();

/** Player station over all my files (object URLs point at the stored files; nothing is downloaded). */
export async function myFilesStation(): Promise<PlayableStation | null> {
  const all = await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>);
  const rows: Row[] = [];
  for (const r of all) {
    const x = await sniff(r.blob);
    if (!x.playable) continue; // never queue a file the browser can't play
    // Older rows may carry an empty/wrong type: re-label from the content.
    rows.push(r.blob.type === x.mime ? r : { ...r, blob: new Blob([r.blob], { type: x.mime }) });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  return {
    id: MY_FILES_ID,
    nameAr: "أم كلثوم – ملفاتي",
    nameEn: "Umm Kulthum — my files",
    country: "EG",
    category: "music",
    identity: "user-confirmed",
    playlist: true,
    onDemand: true,
    streams: rows.map((r) => {
      let url = urls.get(r.id);
      if (!url) urls.set(r.id, (url = URL.createObjectURL(r.blob)));
      return { url, id: `local/${r.id}`, seconds: r.duration || undefined, label: r.title, source: "custom" as const, codec: r.type.split("/")[1]?.toUpperCase() };
    }),
  };
}

export async function storageUse(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && e.quota ? { used: e.usage ?? 0, quota: e.quota } : null;
  } catch {
    return null;
  }
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
