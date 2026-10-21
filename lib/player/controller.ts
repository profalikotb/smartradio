"use client";
import { useSyncExternalStore } from "react";
import { PlayerEngine, type ErrorKind, type HlsLike, type PlayerSnapshot } from "./engine";
import { resolvePlaylist } from "../directoryClient";
import { resolveStation, viewOf, type ResolveResult } from "../stations";
import { getState, update } from "../store";
import { addRecent, recordPlayback } from "../state";
import type { PlayableStation } from "../types";

function silentWav(): string {
  // 0.1 s of 8 kHz mono 8-bit silence, generated (no asset to ship).
  const samples = 800;
  const buf = new Uint8Array(44 + samples);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); dv.setUint32(4, 36 + samples, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  w(36, "data"); dv.setUint32(40, samples, true); buf.fill(128, 44);
  let bin = "";
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  return "data:audio/wav;base64," + btoa(bin);
}

export interface ControllerState {
  pendingId?: string; // station being looked up before playback
  resolveError?: { id: string; reason: Exclude<ResolveResult, { ok: true }>["reason"]; detail?: string };
}

class Controller {
  engine: PlayerEngine;
  private st: ControllerState = {};
  private listeners = new Set<() => void>();
  private resolveAbort: AbortController | null = null;
  private servedFromCache = new Set<string>();
  private refreshedAfterFail = new Set<string>();

  constructor() {
    this.engine = new PlayerEngine({
      createAudio: () => {
        const a = new Audio();
        a.setAttribute("playsinline", "");
        a.crossOrigin = null;
        return a as unknown as import("./engine").AudioLike;
      },
      now: () => Date.now(),
      setTimeout: (f, ms) => window.setTimeout(f, ms),
      clearTimeout: (id) => window.clearTimeout(id as number),
      setInterval: (f, ms) => window.setInterval(f, ms),
      clearInterval: (id) => window.clearInterval(id as number),
      pageIsHttps: () => location.protocol === "https:",
      isOnline: () => navigator.onLine,
      resolvePlaylist,
      loadHls: async () => {
        const mod = await import("hls.js");
        const Hls = mod.default;
        return {
          isSupported: () => Hls.isSupported(),
          create: () => new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20 }) as unknown as HlsLike,
          ERROR: Hls.Events.ERROR,
        };
      },
      silentSrc: silentWav(),
      onPlaybackOk: (id) => {
        this.refreshedAfterFail.delete(id);
        update((s) => {
          let n = recordPlayback(s, id, true);
          n = addRecent(n, id);
          return { ...n, settings: { ...n.settings, lastStationId: id } };
        });
      },
      onPlaybackFailed: (id, kind) => this.onFailed(id, kind),
    });
    this.engine.lowData = getState().settings.lowData;
    this.wireBrowser();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.st;
  private set(p: ControllerState) {
    this.st = p;
    for (const l of this.listeners) l();
  }

  /** Call from a tap handler. Starts immediately from cache when possible, otherwise resolves first. */
  playById(id: string) {
    this.engine.unlock();
    this.resolveAbort?.abort();
    this.engine.lowData = getState().settings.lowData;
    const cached = getState().known[id];
    const view = viewOf(id);

    // Instant path: custom stations, user-confirmed bindings, directory stations, cached verified record.
    const instant = this.instantStation(id);
    if (instant) {
      this.set({});
      this.servedFromCache.add(id);
      this.engine.play(instant);
      return;
    }

    if (view) this.engine.select(placeholder(id, view, cached?.logo));
    this.set({ pendingId: id });
    const ctrl = new AbortController();
    this.resolveAbort = ctrl;
    resolveStation(id, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        if (r.ok) {
          this.set({});
          if (r.fromCache) this.servedFromCache.add(id);
          else this.servedFromCache.delete(id);
          this.engine.play(r.station);
        } else {
          this.set({ resolveError: { id, reason: r.reason, detail: r.detail } });
          update((s) => recordPlayback(s, id, false, r.reason));
        }
      })
      .catch(() => {
        /* aborted by a newer selection */
      });
  }

  private instantStation(id: string): PlayableStation | null {
    const s = getState();
    if (id.startsWith("custom:")) {
      const cu = s.custom.find((x) => `custom:${x.id}` === id);
      return cu ? { id, nameAr: cu.name, nameEn: cu.name, country: "—", category: "general", identity: "user-confirmed", streams: [{ url: cu.url, source: "custom" }] } : null;
    }
    const k = s.known[id];
    if (k?.streams.length) return k; // verified-catalog cache or directory station
    return null;
  }

  /** A cached URL failed → fetch the live directory record once and try again if it changed. */
  private onFailed(id: string, kind: ErrorKind) {
    update((s) => recordPlayback(s, id, false, kind));
    if (!this.servedFromCache.has(id) || this.refreshedAfterFail.has(id) || kind === "offline") return;
    this.refreshedAfterFail.add(id);
    const before = getState().known[id]?.streams.map((x) => x.url).join("|");
    const ctrl = new AbortController();
    this.resolveAbort = ctrl;
    resolveStation(id, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted || !r.ok || r.fromCache) return;
        if (r.station.streams.map((x) => x.url).join("|") !== before && this.engine.getSnapshot().station?.id === id) {
          this.servedFromCache.delete(id);
          this.engine.play(r.station);
        }
      })
      .catch(() => {});
  }

  stop() {
    this.resolveAbort?.abort();
    this.set({});
    this.engine.pause();
  }

  toggle() {
    const snap = this.engine.getSnapshot();
    if (this.st.pendingId) return this.stop();
    if (snap.status === "playing" || snap.status === "buffering" || snap.status === "connecting") return this.engine.pause();
    const id = snap.station?.id ?? getState().settings.lastStationId;
    if (id) this.playById(id);
  }

  retry() {
    const id = this.st.resolveError?.id ?? this.engine.getSnapshot().station?.id;
    if (id) {
      this.servedFromCache.delete(id);
      this.refreshedAfterFail.delete(id);
      // Retry = fresh lookup for verified stations (cached URL may be stale)
      const s = getState();
      if (s.known[id] && viewOf(id)?.identity === "catalog-verified") {
        update((st) => {
          const known = { ...st.known };
          delete known[id];
          return { ...st, known };
        });
      }
      this.playById(id);
    }
  }

  step(delta: 1 | -1) {
    // On a recitation playlist, next/previous move between recordings instead of stations.
    if (!this.st.pendingId && this.engine.skipTrack(delta)) return;
    const favs = getState().favorites;
    if (!favs.length) return;
    const cur = this.st.pendingId ?? this.engine.getSnapshot().station?.id;
    const i = cur ? favs.indexOf(cur) : -1;
    const next = favs[(i + delta + favs.length) % favs.length];
    if (next) this.playById(next);
  }

  private wireBrowser() {
    window.addEventListener("online", () => this.engine.handleOnline());
    window.addEventListener("offline", () => this.engine.handleOffline());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.engine.checkSleepOverdue();
    });
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      const safe = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
        try {
          ms.setActionHandler(a, h);
        } catch {
          /* unsupported action */
        }
      };
      safe("play", () => this.toggle());
      safe("pause", () => this.engine.pause());
      safe("stop", () => this.engine.pause());
      safe("nexttrack", () => this.step(1));
      safe("previoustrack", () => this.step(-1));
      safe("seekbackward", null);
      safe("seekforward", null);
      this.engine.subscribe(() => this.syncMediaSession());
    }
  }

  private lastMeta = "";
  private syncMediaSession() {
    const snap = this.engine.getSnapshot();
    const ms = navigator.mediaSession;
    ms.playbackState = snap.status === "playing" || snap.status === "buffering" ? "playing" : snap.status === "idle" ? "none" : "paused";
    const st = snap.station;
    if (!st) return;
    const s = getState();
    const title = s.nicknames[st.id] || (s.settings.lang === "ar" ? st.nameAr : st.nameEn);
    const track = st.playlist ? snap.stream?.label : undefined;
    const key = `${st.id}|${title}|${s.settings.lang}|${track ?? ""}`;
    if (key === this.lastMeta) return;
    this.lastMeta = key;
    ms.metadata = new MediaMetadata({
      title,
      artist: track ?? (s.settings.lang === "ar" ? "بث مباشر" : "Live broadcast"),
      album: s.settings.lang === "ar" ? "راديو أ.د. على قطب الذكي" : "Prof Ali Kotb Smart Radio",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }
}

function placeholder(id: string, v: { nameAr: string; nameEn: string; country: string; category: PlayableStation["category"]; website?: string; identity: PlayableStation["identity"] }, logo?: string): PlayableStation {
  return { id, nameAr: v.nameAr, nameEn: v.nameEn, country: v.country, category: v.category, website: v.website, identity: v.identity, logo, streams: [] };
}

let instance: Controller | null = null;
export function player(): Controller {
  if (!instance) instance = new Controller();
  return instance;
}

const idleSnap: PlayerSnapshot = {
  status: "idle",
  streamIndex: 0,
  streamCount: 0,
  attempt: 0,
  needsTap: false,
  listenedSeconds: 0,
  volumeSupported: true,
  volume: 1,
};
const idleCtl: ControllerState = {};
const noop = () => () => {};

export function usePlayer(): PlayerSnapshot {
  return useSyncExternalStore(
    typeof window === "undefined" ? noop : (l) => player().engine.subscribe(l),
    () => player().engine.getSnapshot(),
    () => idleSnap,
  );
}

export function useController(): ControllerState {
  return useSyncExternalStore(
    typeof window === "undefined" ? noop : (l) => player().subscribe(l),
    () => player().getSnapshot(),
    () => idleCtl,
  );
}
