/**
 * Single persistent audio engine. Lives at module scope so it survives client-side navigation.
 *
 * Guarantees:
 *  - one <audio> element → no overlapping audio, ever
 *  - every async step is tagged with a generation number; switching stations bumps it and any
 *    stale continuation (timeouts, playlist fetches, hls.js loads, retries) is ignored
 *  - bounded connect/stall timeouts, limited exponential backoff, then alternative streams of the
 *    SAME station, then a clear "unavailable" state — never an endless spinner
 *  - an intentional pause is never undone by reconnect logic
 */
import type { PlayableStation, PlayerStatus, StreamRef } from "../types";

export type ErrorKind =
  | "timeout"
  | "network"
  | "decode"
  | "unsupported"
  | "insecure-only"
  | "no-stream"
  | "autoplay-blocked"
  | "playlist"
  | "offline";

export interface PlayerSnapshot {
  status: PlayerStatus;
  station?: PlayableStation;
  stream?: StreamRef;
  streamIndex: number;
  streamCount: number;
  attempt: number;
  retryAt?: number; // epoch ms of next automatic retry
  error?: ErrorKind;
  needsTap: boolean;
  listenedSeconds: number; // this session, while actually playing
  sleepEndsAt?: number;
  volumeSupported: boolean;
  volume: number;
}

export interface AudioLike {
  src: string;
  volume: number;
  paused: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  canPlayType(t: string): string;
  addEventListener(type: string, fn: (e?: unknown) => void): void;
  error?: { code: number } | null;
  /** true once playback reached the end (browsers fire "pause" right before "ended"). */
  ended?: boolean;
}

export interface HlsLike {
  loadSource(url: string): void;
  attachMedia(media: unknown): void;
  destroy(): void;
  on(evt: string, fn: (evt: string, data: { fatal?: boolean }) => void): void;
}

export interface EngineDeps {
  createAudio(): AudioLike;
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  pageIsHttps(): boolean;
  isOnline(): boolean;
  resolvePlaylist(url: string, signal: AbortSignal): Promise<{ hls: boolean; urls: string[] }>;
  loadHls(): Promise<{ isSupported(): boolean; create(): HlsLike; ERROR: string } | null>;
  onPlaybackOk?(stationId: string): void;
  onPlaybackFailed?(stationId: string, kind: ErrorKind): void;
  onMediaAction?(action: "play" | "pause" | "next" | "previous"): void;
  /** Data URI of a short silent clip used by unlock(). Optional (tests omit it). */
  silentSrc?: string;
}

export const CONNECT_TIMEOUT_MS = 15_000;
export const STALL_TIMEOUT_MS = 20_000;
export const MAX_RETRIES_PER_STREAM = 3;
export const BACKOFF_MS = [1_000, 2_500, 6_000];
export const MAX_PLAYLIST_SKIPS = 5;

const isPlaylistUrl = (u: string) => /\.(pls|m3u)(\?|$)/i.test(u);
const isHlsUrl = (s: StreamRef) => s.hls || /\.m3u8(\?|$)/i.test(s.url);

export function orderStreams(streams: StreamRef[], lowData: boolean): StreamRef[] {
  const list = [...streams];
  if (lowData && list.filter((s) => s.bitrate && s.bitrate > 0).length > 1) {
    list.sort((a, b) => (a.bitrate || 9999) - (b.bitrate || 9999));
  }
  return list;
}

export class PlayerEngine {
  private audio: AudioLike | null = null;
  private hls: HlsLike | null = null;
  private trackFails = 0;
  private gen = 0;
  private timers = new Set<unknown>();
  private stallTimer: unknown = null;
  private tick: unknown = null;
  private sleepTimer: unknown = null;
  private fadeTimer: unknown = null;
  private abort: AbortController | null = null;
  private intentionalPause = false;
  private onlyInsecure = false;
  private unlockGen = -1;
  private unlocked = false;
  private resumeWhenOnline = false;
  private streams: StreamRef[] = [];
  private listeners = new Set<() => void>();
  private snap: PlayerSnapshot = {
    status: "idle",
    streamIndex: 0,
    streamCount: 0,
    attempt: 0,
    needsTap: false,
    listenedSeconds: 0,
    volumeSupported: true,
    volume: 1,
  };
  lowData = false;

  constructor(private deps: EngineDeps) {}

  // ---------- subscription ----------
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  private set(p: Partial<PlayerSnapshot>) {
    this.snap = { ...this.snap, ...p };
    for (const l of this.listeners) l();
  }

  // ---------- setup ----------
  private ensureAudio(): AudioLike {
    if (this.audio) return this.audio;
    const a = this.deps.createAudio();
    a.preload = "none";
    // iOS ignores programmatic volume: setting it is a no-op and reading returns 1.
    try {
      a.volume = 0.5;
      const supported = Math.abs(a.volume - 0.5) < 0.01;
      a.volume = this.snap.volume;
      this.snap = { ...this.snap, volumeSupported: supported };
    } catch {
      this.snap = { ...this.snap, volumeSupported: false };
    }
    const g = () => this.gen;
    a.addEventListener("playing", () => this.onPlaying(g()));
    a.addEventListener("waiting", () => this.onWaiting(g()));
    a.addEventListener("stalled", () => this.onWaiting(g()));
    a.addEventListener("error", () => this.onError(g(), this.mediaErrorKind()));
    a.addEventListener("ended", () => (this.snap.station?.playlist ? this.nextTrack(g()) : this.onError(g(), "network")));
    a.addEventListener("pause", () => {
      // Pauses caused by our own teardown arrive after src was removed → ignore them.
      // A pause while a source is attached (headset button, Control Center, OS interruption)
      // is the user's decision and is treated as intentional.
      // A pause fired because the file/stream reached its end is not the user's pause.
      if (!a.src || this.gen === this.unlockGen || a.ended) return;
      if (this.snap.status === "playing" || this.snap.status === "buffering") {
        this.intentionalPause = true;
        this.clearAttemptTimers();
        this.set({ status: "paused" });
      }
    });
    this.audio = a;
    return a;
  }

  private mediaErrorKind(): ErrorKind {
    const code = this.audio?.error?.code;
    if (code === 4) return "unsupported";
    if (code === 3) return "decode";
    return this.deps.isOnline() ? "network" : "offline";
  }

  // ---------- public API ----------
  /**
   * iOS/WebKit only lets an <audio> element start if play() was first called inside a user gesture.
   * When the stream URL still has to be looked up (async), call this synchronously in the tap handler:
   * it plays a few ms of generated silence on the same element, which unlocks it for the real stream.
   */
  unlock() {
    if (this.unlocked || !this.deps.silentSrc) return;
    const a = this.ensureAudio();
    this.unlockGen = ++this.gen;
    a.src = this.deps.silentSrc;
    const done = () => {
      this.unlocked = true;
      if (this.gen === this.unlockGen) {
        a.pause();
        a.removeAttribute("src");
      }
    };
    a.play().then(done, () => {
      /* not in a gesture; the real play() will report autoplay-blocked if needed */
    });
  }

  get isUnlocked() {
    return this.unlocked;
  }

  /** Start a station. Must be called from a user gesture the first time (browser autoplay policy). */
  play(station: PlayableStation) {
    this.stopInternal();
    const gen = ++this.gen;
    this.intentionalPause = false;
    this.resumeWhenOnline = false;
    const https = this.deps.pageIsHttps();
    // Recitation playlists keep their surah order; live stations are ordered by preference.
    const all = station.playlist ? station.streams : orderStreams(station.streams, this.lowData);
    // On an HTTPS page, HTTPS streams go first. HTTP streams are kept as a last resort: the page's
    // CSP has upgrade-insecure-requests, so the browser requests them over HTTPS on the same host.
    const secure = all.filter((s) => s.url.startsWith("https:"));
    this.streams = https ? [...secure, ...all.filter((s) => !s.url.startsWith("https:"))] : all;
    this.onlyInsecure = https && all.length > 0 && !secure.length;
    this.set({
      station,
      stream: undefined,
      streamIndex: 0,
      streamCount: this.streams.length,
      attempt: 0,
      error: undefined,
      retryAt: undefined,
      needsTap: false,
      status: "connecting",
    });
    if (!all.length) return this.fail(gen, "no-stream");
    if (!this.deps.isOnline()) {
      this.resumeWhenOnline = true;
      return this.set({ status: "offline", error: "offline" });
    }
    void this.attempt(gen);
  }

  /** Select without playing (one-tap return after relaunch). */
  select(station: PlayableStation) {
    if (this.snap.station?.id === station.id) return;
    this.stopInternal();
    this.gen++;
    this.set({ station, status: "idle", error: undefined, needsTap: false, streamIndex: 0, streamCount: station.streams.length, attempt: 0 });
  }

  pause() {
    this.intentionalPause = true;
    this.resumeWhenOnline = false;
    this.gen++; // cancel pending retries/fetches
    this.clearAttemptTimers();
    this.abort?.abort();
    if (this.audio) this.audio.pause();
    this.teardownSource(); // live radio: resume = reconnect to the live edge, not stale buffer
    this.set({ status: this.snap.station ? "paused" : "idle", retryAt: undefined });
  }

  toggle() {
    const st = this.snap.status;
    if (st === "playing" || st === "buffering" || st === "connecting") return this.pause();
    if (this.snap.station) this.play(this.snap.station);
  }

  /** Manual retry: restart from the first stream of the current station. */
  retry() {
    if (this.snap.station) this.play(this.snap.station);
  }

  /** Stop trying (connecting / waiting for retry / offline). */
  cancel() {
    this.pause();
  }

  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.audio) this.audio.volume = vol;
    this.set({ volume: vol });
  }

  // ---------- sleep timer ----------
  startSleep(minutes: number, fade: boolean) {
    this.cancelSleep();
    const ms = Math.max(1, Math.min(600, minutes)) * 60_000;
    const endsAt = this.deps.now() + ms;
    this.set({ sleepEndsAt: endsAt });
    const fadeMs = fade && this.snap.volumeSupported ? Math.min(30_000, ms) : 0;
    if (fadeMs) this.sleepTimer = this.deps.setTimeout(() => this.beginFade(fadeMs), ms - fadeMs);
    else this.sleepTimer = this.deps.setTimeout(() => this.sleepNow(), ms);
  }

  cancelSleep() {
    if (this.sleepTimer) this.deps.clearTimeout(this.sleepTimer);
    if (this.fadeTimer) this.deps.clearInterval(this.fadeTimer);
    this.sleepTimer = this.fadeTimer = null;
    if (this.audio && this.snap.volumeSupported) this.audio.volume = this.snap.volume;
    if (this.snap.sleepEndsAt) this.set({ sleepEndsAt: undefined });
  }

  /** Call on visibility change: timers may have been suspended by the OS while in background. */
  checkSleepOverdue() {
    if (this.snap.sleepEndsAt && this.deps.now() >= this.snap.sleepEndsAt) this.sleepNow();
  }

  private beginFade(fadeMs: number) {
    const start = this.deps.now();
    const base = this.snap.volume;
    this.fadeTimer = this.deps.setInterval(() => {
      const k = 1 - (this.deps.now() - start) / fadeMs;
      if (k <= 0) return this.sleepNow();
      if (this.audio) this.audio.volume = Math.max(0, base * k);
    }, 500);
  }

  private sleepNow() {
    this.pause();
    this.cancelSleep();
  }

  // ---------- network hooks ----------
  handleOffline() {
    const st = this.snap.status;
    if (st === "playing" || st === "buffering" || st === "connecting") {
      this.resumeWhenOnline = !this.intentionalPause;
      this.gen++;
      this.clearAttemptTimers();
      this.abort?.abort();
      this.teardownSource();
      this.set({ status: "offline", error: "offline", retryAt: undefined });
    }
  }

  handleOnline() {
    if (this.resumeWhenOnline && !this.intentionalPause && this.snap.station) {
      this.resumeWhenOnline = false;
      this.play(this.snap.station);
    }
  }

  // ---------- internals ----------
  private async attempt(gen: number) {
    const stream = this.streams[this.snap.streamIndex];
    if (!stream) return this.fail(gen, "no-stream");
    const audio = this.ensureAudio();
    this.set({ stream, status: this.snap.attempt ? "buffering" : "connecting", retryAt: undefined });
    this.armTimer(gen, CONNECT_TIMEOUT_MS, () => this.onError(gen, "timeout"));

    let url = stream.url;
    let hls = isHlsUrl(stream);
    if (isPlaylistUrl(url)) {
      this.abort = new AbortController();
      try {
        const r = await this.deps.resolvePlaylist(url, this.abort.signal);
        if (gen !== this.gen) return;
        const next = r.urls.find((u) => u.startsWith("https:")) ?? r.urls[0];
        if (!next) return this.onError(gen, "playlist");
        url = next;
        hls = r.hls || /\.m3u8(\?|$)/i.test(next);
      } catch {
        if (gen !== this.gen) return;
        return this.onError(gen, "playlist");
      }
    }

    if (hls && !audio.canPlayType("application/vnd.apple.mpegurl")) {
      const H = await this.deps.loadHls().catch(() => null);
      if (gen !== this.gen) return;
      if (!H || !H.isSupported()) return this.onError(gen, "unsupported");
      const inst = H.create();
      this.hls = inst;
      inst.on(H.ERROR, (_e, data) => {
        if (data?.fatal) this.onError(gen, this.deps.isOnline() ? "network" : "offline");
      });
      inst.loadSource(url);
      inst.attachMedia(audio);
    } else {
      audio.src = url;
    }

    try {
      await audio.play();
    } catch (e) {
      if (gen !== this.gen) return;
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError") {
        this.clearAttemptTimers();
        this.teardownSource();
        return this.set({ status: "paused", needsTap: true, error: "autoplay-blocked" });
      }
      if (name === "NotSupportedError") return this.onError(gen, "unsupported");
      if (name === "AbortError") return; // superseded by a newer load
      return this.onError(gen, this.deps.isOnline() ? "network" : "offline");
    }
  }

  private onPlaying(gen: number) {
    if (gen !== this.gen || gen === this.unlockGen || this.intentionalPause) return;
    this.clearAttemptTimers();
    const first = this.snap.status !== "playing";
    this.trackFails = 0;
    this.set({ status: "playing", attempt: 0, error: undefined, needsTap: false, retryAt: undefined });
    if (first && this.snap.station) this.deps.onPlaybackOk?.(this.snap.station.id);
    if (!this.tick)
      this.tick = this.deps.setInterval(() => {
        if (this.snap.status === "playing") this.set({ listenedSeconds: this.snap.listenedSeconds + 1 });
      }, 1000);
  }

  private onWaiting(gen: number) {
    if (gen !== this.gen || gen === this.unlockGen || this.intentionalPause) return;
    if (this.snap.status === "playing") this.set({ status: "buffering" });
    if (this.stallTimer) this.deps.clearTimeout(this.stallTimer);
    this.stallTimer = this.deps.setTimeout(() => {
      this.stallTimer = null;
      if (gen === this.gen && this.snap.status === "buffering") this.onError(gen, "timeout");
    }, STALL_TIMEOUT_MS);
  }

  private onError(gen: number, kind: ErrorKind) {
    if (gen !== this.gen || gen === this.unlockGen || this.intentionalPause) return;
    this.clearAttemptTimers();
    this.teardownSource();
    if (kind === "offline" || !this.deps.isOnline()) {
      this.resumeWhenOnline = true;
      return this.set({ status: "offline", error: "offline" });
    }
    const permanent = kind === "unsupported" || kind === "insecure-only" || kind === "playlist" || kind === "decode";
    const attempt = this.snap.attempt;
    if (!permanent && attempt < MAX_RETRIES_PER_STREAM) {
      const delay = BACKOFF_MS[attempt]! + Math.floor(Math.random() * 400);
      const nextGen = ++this.gen;
      this.set({ attempt: attempt + 1, status: "buffering", error: kind, retryAt: this.deps.now() + delay });
      this.armTimer(nextGen, delay, () => void this.attempt(nextGen));
      return;
    }
    // Recitation playlist: skip a broken surah file, but stop after several failures in a row.
    if (this.snap.station?.playlist && this.streams.length > 1) {
      if (++this.trackFails < Math.min(MAX_PLAYLIST_SKIPS, this.streams.length)) return this.nextTrack(gen, kind);
      return this.fail(gen, kind);
    }
    // Same-station alternative stream, if any.
    if (this.snap.streamIndex + 1 < this.streams.length) {
      const nextGen = ++this.gen;
      this.set({ streamIndex: this.snap.streamIndex + 1, attempt: 0, error: kind });
      void this.attempt(nextGen);
      return;
    }
    this.fail(gen, kind);
  }

  /** Playlist stations: next surah (wraps from the last to the first). */
  /** Lock-screen / player next & previous on a recitation playlist: move between recordings. */
  skipTrack(delta: 1 | -1): boolean {
    if (!this.snap.station?.playlist || this.streams.length < 2) return false;
    this.intentionalPause = false;
    this.trackFails = 0;
    this.nextTrack(this.gen, undefined, delta);
    return true;
  }

  private nextTrack(gen: number, error?: ErrorKind, delta = 1) {
    if (gen !== this.gen || gen === this.unlockGen || this.intentionalPause || !this.streams.length) return;
    this.clearAttemptTimers();
    this.teardownSource();
    const nextGen = ++this.gen;
    const n = this.streams.length;
    this.set({ streamIndex: (this.snap.streamIndex + delta + n) % n, attempt: 0, error, status: "buffering" });
    void this.attempt(nextGen);
  }

  private fail(gen: number, kind: ErrorKind) {
    if (gen !== this.gen) return;
    this.clearAttemptTimers();
    this.teardownSource();
    const final: ErrorKind = this.onlyInsecure && kind !== "offline" ? "insecure-only" : kind;
    this.set({ status: "unavailable", error: final, retryAt: undefined });
    if (this.snap.station) this.deps.onPlaybackFailed?.(this.snap.station.id, final);
  }

  private armTimer(gen: number, ms: number, fn: () => void) {
    const id = this.deps.setTimeout(() => {
      this.timers.delete(id);
      if (gen === this.gen) fn();
    }, ms);
    this.timers.add(id);
  }

  private clearAttemptTimers() {
    for (const t of this.timers) this.deps.clearTimeout(t);
    this.timers.clear();
    if (this.stallTimer) this.deps.clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }

  private teardownSource() {
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {
        /* ignore */
      }
      this.hls = null;
    }
    if (this.audio) {
      // Detach first: any resulting "pause" event (sync in some engines, queued in others) then sees
      // no src and is not mistaken for a user pause.
      this.audio.removeAttribute("src");
      this.audio.pause();
      try {
        this.audio.load();
      } catch {
        /* ignore */
      }
    }
  }

  private stopInternal() {
    this.clearAttemptTimers();
    this.abort?.abort();
    this.abort = null;
    this.teardownSource();
  }
}
