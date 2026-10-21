import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKOFF_MS, CONNECT_TIMEOUT_MS, MAX_RETRIES_PER_STREAM, PlayerEngine, type AudioLike, type EngineDeps } from "@/lib/player/engine";
import type { PlayableStation } from "@/lib/types";

class FakeAudio implements AudioLike {
  private _src = "";
  volume = 1;
  paused = true;
  preload = "";
  error: { code: number } | null = null;
  playMode: "ok" | "notallowed" = "ok";
  ended = false;
  loads: string[] = [];
  private l: Record<string, ((e?: unknown) => void)[]> = {};
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    if (v) this.loads.push(v);
  }
  addEventListener(t: string, fn: (e?: unknown) => void) {
    (this.l[t] ??= []).push(fn);
  }
  emit(t: string) {
    for (const f of this.l[t] ?? []) f();
  }
  play() {
    if (this.playMode === "notallowed") return Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    const was = !this.paused;
    this.paused = true;
    if (was) this.emit("pause");
  }
  load() {}
  removeAttribute(n: string) {
    if (n === "src") this._src = "";
  }
  canPlayType() {
    return "";
  }
}

const st = (id: string, ...urls: string[]): PlayableStation => ({
  id, nameAr: id, nameEn: id, country: "EG", category: "general", identity: "catalog-verified",
  streams: urls.map((url, i) => ({ url, bitrate: 128 - i * 64, source: "radio-browser" as const })),
});

let audio: FakeAudio;
let online: boolean;
let deps: EngineDeps;
let ok: string[];
let failed: [string, string][];

function mk(extra: Partial<EngineDeps> = {}) {
  audio = new FakeAudio();
  online = true;
  ok = [];
  failed = [];
  deps = {
    createAudio: () => audio,
    now: () => Date.now(),
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    setInterval: (f, ms) => setInterval(f, ms),
    clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
    pageIsHttps: () => true,
    isOnline: () => online,
    resolvePlaylist: async () => ({ hls: false, urls: ["https://resolved.example/live"] }),
    loadHls: async () => null,
    onPlaybackOk: (id) => ok.push(id),
    onPlaybackFailed: (id, k) => failed.push([id, k]),
    ...extra,
  };
  return new PlayerEngine(deps);
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("playback state", () => {
  it("connecting → playing on real 'playing' event only", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    expect(e.getSnapshot().status).toBe("connecting");
    audio.emit("playing");
    expect(e.getSnapshot().status).toBe("playing");
    expect(ok).toEqual(["A"]);
  });

  it("autoplay rejection → paused + needsTap, no retry loop", async () => {
    const e = mk();
    audio.playMode = "notallowed";
    e.play(st("A", "https://a/1"));
    await flush();
    expect(e.getSnapshot()).toMatchObject({ status: "paused", needsTap: true, error: "autoplay-blocked" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(audio.loads).toHaveLength(1);
  });

  it("external pause (lock screen / headset) is treated as intentional", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.emit("playing");
    audio.pause(); // OS-level pause with src still attached
    expect(e.getSnapshot().status).toBe("paused");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(audio.loads).toHaveLength(1);
  });
});

describe("retry, backoff and alternatives", () => {
  it("connect timeout → limited exponential backoff → alternative stream → unavailable", async () => {
    const e = mk();
    e.play(st("A", "https://a/1", "https://a/2"));
    await flush();
    for (let i = 0; i < MAX_RETRIES_PER_STREAM; i++) {
      await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
      expect(e.getSnapshot()).toMatchObject({ status: "buffering", attempt: i + 1 });
      expect(e.getSnapshot().retryAt).toBeDefined();
      await vi.advanceTimersByTimeAsync(BACKOFF_MS[i]! + 400);
    }
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS); // stream 1 exhausted → stream 2
    expect(e.getSnapshot().streamIndex).toBe(1);
    expect(audio.src).toBe("https://a/2");
    for (let i = 0; i < MAX_RETRIES_PER_STREAM; i++) {
      await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(BACKOFF_MS[i]! + 400);
    }
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
    expect(e.getSnapshot()).toMatchObject({ status: "unavailable", error: "timeout" });
    expect(failed).toEqual([["A", "timeout"]]);
    expect(audio.loads).toHaveLength(2 * (MAX_RETRIES_PER_STREAM + 1)); // bounded
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(audio.loads).toHaveLength(2 * (MAX_RETRIES_PER_STREAM + 1)); // no endless retrying
  });

  it("unsupported format skips retries and goes straight to the next stream", async () => {
    const e = mk();
    e.play(st("A", "https://a/1", "https://a/2"));
    await flush();
    audio.error = { code: 4 };
    audio.emit("error");
    await flush();
    expect(audio.src).toBe("https://a/2");
  });

  it("never switches to a different station on failure", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.error = { code: 4 };
    audio.emit("error");
    await flush();
    expect(e.getSnapshot().station?.id).toBe("A");
    expect(e.getSnapshot().status).toBe("unavailable");
  });

  it("HTTP-only station on an HTTPS page: tried (browser upgrade), then reported as insecure-only", async () => {
    const e = mk();
    e.play(st("A", "http://plain/1"));
    await flush();
    audio.error = { code: 4 };
    audio.emit("error");
    await flush();
    expect(e.getSnapshot()).toMatchObject({ status: "unavailable", error: "insecure-only" });
  });

  it("no streams → unavailable/no-stream immediately", () => {
    const e = mk();
    e.play(st("A"));
    expect(e.getSnapshot()).toMatchObject({ status: "unavailable", error: "no-stream" });
  });

  it("manual cancel stops all pending retries", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);
    e.cancel();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(audio.loads).toHaveLength(1);
    expect(e.getSnapshot().status).toBe("paused");
  });
});

describe("network loss and recovery", () => {
  it("offline while playing → offline; back online → reconnects", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.emit("playing");
    online = false;
    e.handleOffline();
    expect(e.getSnapshot().status).toBe("offline");
    online = true;
    e.handleOnline();
    await flush();
    expect(audio.loads).toHaveLength(2);
    expect(e.getSnapshot().status).toBe("connecting");
  });

  it("never restarts after an intentional pause, even when the network returns", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.emit("playing");
    e.pause();
    online = false;
    e.handleOffline();
    online = true;
    e.handleOnline();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(audio.loads).toHaveLength(1);
    expect(e.getSnapshot().status).toBe("paused");
  });

  it("pressing play while offline waits for the network instead of spinning", async () => {
    const e = mk();
    online = false;
    e.play(st("A", "https://a/1"));
    expect(e.getSnapshot().status).toBe("offline");
    expect(audio.loads).toHaveLength(0);
    online = true;
    e.handleOnline();
    await flush();
    expect(audio.loads).toHaveLength(1);
  });
});

describe("rapid station switching", () => {
  it("only the last selection plays; stale timers and async results are ignored", async () => {
    let release!: (v: { hls: boolean; urls: string[] }) => void;
    const e = mk({ resolvePlaylist: () => new Promise((r) => (release = r)) });
    e.play(st("A", "https://a/list.pls")); // waits on playlist
    await flush();
    e.play(st("B", "https://b/1"));
    e.play(st("C", "https://c/1"));
    await flush();
    release({ hls: false, urls: ["https://a/real"] }); // A's late result
    await flush();
    expect(audio.src).toBe("https://c/1");
    expect(audio.loads).not.toContain("https://a/real");
    audio.emit("playing");
    expect(e.getSnapshot().station?.id).toBe("C");
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS * 3); // A/B timeouts must not fire
    expect(e.getSnapshot().status).toBe("playing");
    expect(ok).toEqual(["C"]);
  });

  it("one audio element for everything (no overlapping audio)", () => {
    let created = 0;
    const e = mk({ createAudio: () => (created++, audio) });
    e.play(st("A", "https://a/1"));
    e.play(st("B", "https://b/1"));
    e.play(st("C", "https://c/1"));
    expect(created).toBe(1);
  });
});

describe("low-data mode and sleep timer", () => {
  it("low-data picks the lowest real bitrate when alternatives exist", async () => {
    const e = mk();
    e.lowData = true;
    e.play(st("A", "https://a/128", "https://a/64"));
    await flush();
    expect(audio.src).toBe("https://a/64");
  });

  it("sleep timer pauses after the duration (fade path)", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.emit("playing");
    e.startSleep(1, true);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(audio.volume).toBeLessThan(1);
    await vi.advanceTimersByTimeAsync(16_000);
    expect(e.getSnapshot().status).toBe("paused");
    expect(e.getSnapshot().sleepEndsAt).toBeUndefined();
    expect(audio.volume).toBe(1); // restored for next session
  });

  it("overdue timer (OS suspended JS) is enforced on return to foreground", async () => {
    const e = mk();
    e.play(st("A", "https://a/1"));
    await flush();
    audio.emit("playing");
    e.startSleep(15, false);
    vi.setSystemTime(Date.now() + 16 * 60_000); // clock moved, timers didn't run
    e.checkSleepOverdue();
    expect(e.getSnapshot().status).toBe("paused");
  });
});

describe("recitation playlist (surah files)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const pl = (): PlayableStation => ({
    ...st("pl", "https://x/001.mp3", "https://x/002.mp3", "https://x/003.mp3"),
    playlist: true,
  });
  it("a finished surah starts the next one, in order, and wraps after the last", async () => {
    const e = mk();
    e.play(pl());
    await flush();
    audio.emit("playing");
    for (let i = 0; i < 3; i++) {
      // Real browsers: reaching the end sets ended=true and fires "pause" BEFORE "ended".
      audio.ended = true;
      audio.paused = true;
      audio.emit("pause");
      audio.emit("ended");
      audio.ended = false;
      await flush();
      audio.emit("playing");
    }
    expect(audio.loads).toEqual(["https://x/001.mp3", "https://x/002.mp3", "https://x/003.mp3", "https://x/001.mp3"]);
    expect(e.getSnapshot().status).toBe("playing");
    expect(failed).toEqual([]);
  });
  it("a broken surah file is skipped instead of stopping the station", async () => {
    const e = mk();
    e.play(pl());
    await flush();
    audio.error = { code: 4 };
    audio.emit("error"); // unsupported → no retries
    await flush();
    expect(audio.loads.at(-1)).toBe("https://x/002.mp3");
    expect(e.getSnapshot().status).not.toBe("unavailable");
  });
  it("stops (unavailable) when every surah fails", async () => {
    const e = mk();
    e.play(pl());
    for (let i = 0; i < 4; i++) {
      await flush();
      audio.error = { code: 4 };
      audio.emit("error");
    }
    await flush();
    expect(e.getSnapshot().status).toBe("unavailable");
  });
});

describe("playlist next/previous", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("skipTrack moves between recordings (wrapping both ways); live stations are untouched", async () => {
    const e = mk();
    e.play({ ...st("pl", "https://x/a.mp3", "https://x/b.mp3", "https://x/c.mp3"), playlist: true });
    await flush();
    audio.emit("playing");
    expect(e.skipTrack(-1)).toBe(true);
    await flush();
    expect(audio.loads.at(-1)).toBe("https://x/c.mp3");
    expect(e.skipTrack(1)).toBe(true);
    await flush();
    expect(audio.loads.at(-1)).toBe("https://x/a.mp3");
    const f = mk();
    f.play(st("live", "https://x/live"));
    expect(f.skipTrack(1)).toBe(false);
  });
});
