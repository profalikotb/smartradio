/** Pure state model + reducers. No browser APIs here, so everything is unit-testable. */
import { AL_AGHANI_ID, QURAN_CAIRO_ID } from "./catalog";
import type { CustomStation, Lang, PlayableStation, StreamRef } from "./types";

export const SCHEMA = 1;
export const APP_ID = "prof-ali-kotb-smart-radio";

export interface Group {
  id: string;
  name: string;
  stationIds: string[];
}

export interface Binding {
  stream: StreamRef;
  alternatives: StreamRef[];
  rbUuid: string;
  directoryName: string;
  homepage?: string;
  confirmedAt: string; // ISO
}

export interface PlaybackInfo {
  lastOkAt?: number;
  lastError?: string;
  lastErrorAt?: number;
}

export interface Settings {
  lang: Lang;
  theme: "system" | "light" | "dark";
  textScale: number; // 1 | 1.15 | 1.3
  lowData: boolean;
  fadeOnSleep: boolean;
  volume: number; // 0..1, ignored by iOS
  lastStationId?: string;
}

export interface AppState {
  schema: number;
  seedVersion: number;
  favorites: string[];
  pinned: string[];
  nicknames: Record<string, string>;
  groups: Group[];
  recent: { id: string; at: number }[];
  custom: CustomStation[];
  bindings: Record<string, Binding>;
  known: Record<string, PlayableStation>; // snapshot of directory stations the user interacted with
  playback: Record<string, PlaybackInfo>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "ar",
  theme: "system",
  textScale: 1,
  lowData: false,
  fadeOnSleep: true,
  volume: 1,
};

export function emptyState(): AppState {
  return {
    schema: SCHEMA,
    seedVersion: 0,
    favorites: [],
    pinned: [],
    nicknames: {},
    groups: [],
    recent: [],
    custom: [],
    bindings: {},
    known: {},
    playback: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Versioned, one-time seeds. Each version is applied exactly once, in order, and only ADDS what is
 * missing at the END of the user's lists. Removing or reordering a seeded station is permanent.
 */
interface Seed {
  favorites: string[];
  pinned: string[];
  groups: Group[];
}
export const SEEDS: Record<number, Seed> = {
  1: {
    favorites: [QURAN_CAIRO_ID, AL_AGHANI_ID],
    pinned: [QURAN_CAIRO_ID, AL_AGHANI_ID],
    groups: [
      { id: "g-quran", name: "القرآن الكريم", stationIds: [QURAN_CAIRO_ID] },
      { id: "g-aghani", name: "الأغاني", stationIds: [AL_AGHANI_ID] },
      { id: "g-news", name: "الأخبار", stationIds: [] },
      { id: "g-fav", name: "المفضلة", stationIds: [] },
    ],
  },
};
export const CURRENT_SEED = Math.max(...Object.keys(SEEDS).map(Number));

export function applySeeds(s: AppState, seeds: Record<number, Seed> = SEEDS): AppState {
  const target = Math.max(...Object.keys(seeds).map(Number));
  if (s.seedVersion >= target) return s;
  const next: AppState = { ...s, favorites: [...s.favorites], pinned: [...s.pinned], groups: [...s.groups] };
  for (let v = s.seedVersion + 1; v <= target; v++) {
    const seed = seeds[v];
    if (!seed) continue;
    for (const id of seed.favorites) if (!next.favorites.includes(id)) next.favorites.push(id);
    for (const id of seed.pinned) if (!next.pinned.includes(id)) next.pinned.push(id);
    for (const g of seed.groups) if (!next.groups.some((x) => x.id === g.id)) next.groups.push({ ...g, stationIds: [...g.stationIds] });
  }
  next.seedVersion = target;
  return next;
}

// ---------- reducers ----------

export function toggleFavorite(s: AppState, id: string): AppState {
  const has = s.favorites.includes(id);
  return { ...s, favorites: has ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] };
}

export function moveFavorite(s: AppState, id: string, delta: number): AppState {
  const i = s.favorites.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= s.favorites.length) return s;
  const f = [...s.favorites];
  [f[i], f[j]] = [f[j]!, f[i]!];
  return { ...s, favorites: f };
}

export function togglePin(s: AppState, id: string): AppState {
  const has = s.pinned.includes(id);
  return { ...s, pinned: has ? s.pinned.filter((x) => x !== id) : [...s.pinned, id] };
}

export function setNickname(s: AppState, id: string, name: string): AppState {
  const nicknames = { ...s.nicknames };
  const v = name.trim().slice(0, 60);
  if (v) nicknames[id] = v;
  else delete nicknames[id];
  return { ...s, nicknames };
}

export function addRecent(s: AppState, id: string, at = Date.now()): AppState {
  return { ...s, recent: [{ id, at }, ...s.recent.filter((r) => r.id !== id)].slice(0, 20) };
}

export function upsertGroup(s: AppState, g: Group): AppState {
  const exists = s.groups.some((x) => x.id === g.id);
  return { ...s, groups: exists ? s.groups.map((x) => (x.id === g.id ? g : x)) : [...s.groups, g] };
}

export function toggleInGroup(s: AppState, groupId: string, stationId: string): AppState {
  return {
    ...s,
    groups: s.groups.map((g) =>
      g.id !== groupId
        ? g
        : { ...g, stationIds: g.stationIds.includes(stationId) ? g.stationIds.filter((x) => x !== stationId) : [...g.stationIds, stationId] },
    ),
  };
}

export function removeGroup(s: AppState, groupId: string): AppState {
  return { ...s, groups: s.groups.filter((g) => g.id !== groupId) };
}

export function recordPlayback(s: AppState, id: string, ok: boolean, error?: string, at = Date.now()): AppState {
  const prev = s.playback[id] ?? {};
  const info: PlaybackInfo = ok ? { ...prev, lastOkAt: at } : { ...prev, lastError: error ?? "error", lastErrorAt: at };
  return { ...s, playback: { ...s.playback, [id]: info } };
}

// ---------- export / import ----------

export interface ExportFile {
  app: typeof APP_ID;
  schema: number;
  exportedAt: string;
  data: Omit<AppState, "schema" | "seedVersion" | "playback">;
}

export function exportState(s: AppState): ExportFile {
  const { schema: _schema, seedVersion: _seed, playback: _pb, ...data } = s;
  return { app: APP_ID, schema: SCHEMA, exportedAt: new Date().toISOString(), data };
}

export class ImportError extends Error {}

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const httpUrl = (v: unknown): v is string => {
  if (!isStr(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};
const validStream = (v: unknown): v is StreamRef => !!v && typeof v === "object" && httpUrl((v as StreamRef).url);

/** Validates an export file and returns the restored state. Seeds never re-apply after an import. */
export function importState(current: AppState, raw: unknown): AppState {
  if (!raw || typeof raw !== "object") throw new ImportError("not-an-object");
  const f = raw as Partial<ExportFile>;
  if (f.app !== APP_ID) throw new ImportError("wrong-app");
  if (typeof f.schema !== "number" || f.schema > SCHEMA) throw new ImportError("unsupported-schema");
  const d = f.data as Partial<AppState> | undefined;
  if (!d || typeof d !== "object") throw new ImportError("missing-data");
  if (!isStrArr(d.favorites)) throw new ImportError("bad-favorites");

  const uniq = (a: string[]) => [...new Set(a)].slice(0, 500);
  const groups = Array.isArray(d.groups)
    ? d.groups
        .filter((g): g is Group => !!g && isStr(g.id) && isStr(g.name) && isStrArr(g.stationIds))
        .map((g) => ({ id: g.id.slice(0, 40), name: g.name.slice(0, 60), stationIds: uniq(g.stationIds) }))
    : current.groups;
  const custom = Array.isArray(d.custom)
    ? d.custom.filter((c): c is CustomStation => !!c && isStr(c.id) && isStr(c.name) && httpUrl(c.url)).slice(0, 200)
    : current.custom;
  const nicknames: Record<string, string> = {};
  if (d.nicknames && typeof d.nicknames === "object")
    for (const [k, v] of Object.entries(d.nicknames)) if (isStr(v)) nicknames[k] = v.slice(0, 60);
  const bindings: Record<string, Binding> = {};
  if (d.bindings && typeof d.bindings === "object")
    for (const [k, v] of Object.entries(d.bindings))
      if (v && validStream((v as Binding).stream) && isStr((v as Binding).rbUuid))
        bindings[k] = { ...(v as Binding), alternatives: ((v as Binding).alternatives ?? []).filter(validStream) };
  const known: Record<string, PlayableStation> = {};
  if (d.known && typeof d.known === "object")
    for (const [k, v] of Object.entries(d.known))
      if (v && isStr((v as PlayableStation).nameEn) && Array.isArray((v as PlayableStation).streams))
        known[k] = { ...(v as PlayableStation), streams: (v as PlayableStation).streams.filter(validStream) };

  const st = (d.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    lang: st.lang === "en" ? "en" : st.lang === "ar" ? "ar" : current.settings.lang,
    theme: st.theme === "light" || st.theme === "dark" || st.theme === "system" ? st.theme : current.settings.theme,
    textScale: typeof st.textScale === "number" && st.textScale >= 0.9 && st.textScale <= 1.5 ? st.textScale : current.settings.textScale,
    lowData: typeof st.lowData === "boolean" ? st.lowData : current.settings.lowData,
    fadeOnSleep: typeof st.fadeOnSleep === "boolean" ? st.fadeOnSleep : current.settings.fadeOnSleep,
    volume: typeof st.volume === "number" && st.volume >= 0 && st.volume <= 1 ? st.volume : current.settings.volume,
    lastStationId: isStr(st.lastStationId) ? st.lastStationId : current.settings.lastStationId,
  };

  return {
    ...current,
    seedVersion: Math.max(current.seedVersion, CURRENT_SEED),
    favorites: uniq(d.favorites),
    pinned: isStrArr(d.pinned) ? uniq(d.pinned) : current.pinned,
    nicknames,
    groups,
    recent: Array.isArray(d.recent)
      ? d.recent.filter((r) => r && isStr(r.id) && typeof r.at === "number").slice(0, 20)
      : current.recent,
    custom,
    bindings,
    known,
    settings,
  };
}

/** Defensive load of whatever is in storage (old/corrupt data never crashes the app). */
export function hydrate(raw: string | null): AppState {
  if (!raw) return applySeeds(emptyState());
  try {
    const p = JSON.parse(raw) as Partial<AppState>;
    const base = emptyState();
    const s: AppState = {
      ...base,
      ...p,
      settings: { ...base.settings, ...(p.settings ?? {}) },
      schema: SCHEMA,
      seedVersion: typeof p.seedVersion === "number" ? p.seedVersion : 0,
    };
    for (const k of ["favorites", "pinned", "groups", "recent", "custom"] as const) if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown>)[k] = [];
    return applySeeds(s);
  } catch {
    return applySeeds(emptyState());
  }
}
