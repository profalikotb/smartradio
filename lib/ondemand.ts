"use client";
import { player } from "./player/controller";
import type { PlayableStation } from "./types";
import { markDone, markPlayback, recordPosition, resumePosition, setLast, type LastListen, type ProgressStore } from "./tafsir/progress";

/**
 * Recorded-audio sections (Tafsir Al-Sha'rawi, Umm Kulthum…) share one engine. Each section registers
 * the player-id prefix it owns and its progress store; this module saves positions for whichever
 * section is playing: every 5 s while playing, on pause/completion, on track change, and when hidden.
 */
export interface OnDemandSection {
  prefix: string;
  store: ProgressStore;
  /** Where-I-stopped record for a track of one of this section's stations. */
  lastOf(station: PlayableStation, index: number, pos: number): LastListen | null;
}

const sections: OnDemandSection[] = [];

export function registerSection(s: OnDemandSection) {
  if (!sections.some((x) => x.prefix === s.prefix)) sections.push(s);
}

export function sectionOf(stationId?: string): OnDemandSection | undefined {
  return stationId ? sections.find((s) => stationId.startsWith(s.prefix)) : undefined;
}

/** Start a track of a section station (from a tap) at its saved second, applying saved speed/repeat. */
export function playTrack(sec: OnDemandSection, station: PlayableStation, index: number, opts: { fromStart?: boolean; at?: number } = {}) {
  const p = sec.store.get();
  const ep = station.streams[index];
  if (!ep?.id) return;
  const at = opts.fromStart ? 0 : opts.at ?? resumePosition(p, ep.id);
  const e = player().engine;
  e.setRate(p.rate);
  e.setRepeat(p.repeat);
  player().playPrepared(station, { index, at });
  const last = sec.lastOf(station, index, at);
  if (last) sec.store.update((x) => setLast(x, last), true);
}

let wired = false;
export function wireOnDemand() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  const e = player().engine;
  let lastKey = "";
  let lastSavedPos = -1;
  let lastStatus = "";
  e.subscribe(() => {
    const s = e.getSnapshot();
    const st = s.station;
    const sec = st?.onDemand ? sectionOf(st.id) : undefined;
    if (!st || !sec) {
      lastKey = "";
      lastStatus = s.status;
      return;
    }
    const ep = st.streams[s.streamIndex];
    if (!ep?.id) return;
    const id = ep.id;
    const key = `${st.id}|${s.streamIndex}`;
    const statusChanged = s.status !== lastStatus;
    if (key !== lastKey) {
      lastKey = key;
      lastSavedPos = -1;
      const last = sec.lastOf(st, s.streamIndex, s.position);
      if (last) sec.store.update((p) => setLast(p, last), true);
    }
    if (statusChanged && s.status === "playing") sec.store.update((p) => markPlayback(p, id, true));
    if (statusChanged && s.status === "unavailable") sec.store.update((p) => markPlayback(p, id, false), true);
    const paused = statusChanged && (s.status === "paused" || s.status === "completed");
    if ((s.status === "playing" && Math.abs(s.position - lastSavedPos) >= 5) || paused) {
      lastSavedPos = s.position;
      sec.store.update((p) => {
        let n = recordPosition(p, id, s.position, s.duration || ep.seconds || 0);
        const last = sec.lastOf(st, s.streamIndex, s.position);
        if (last) n = setLast(n, last);
        return n;
      }, paused);
    }
    lastStatus = s.status;
  });
  player().setTafsirHooks({
    startPositionFor: (station, index) => {
      const sec = sectionOf(station.id);
      const id = station.streams[index]?.id;
      return sec && id ? resumePosition(sec.store.get(), id) : undefined;
    },
    onTrackEnded: (station, index) => {
      const sec = sectionOf(station.id);
      const id = station.streams[index]?.id;
      if (sec && id) sec.store.update((p) => markDone(p, id), true);
    },
  });
}
