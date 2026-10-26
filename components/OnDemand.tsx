"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { player, usePlayer } from "@/lib/player/controller";
import type { RepeatMode } from "@/lib/player/engine";
import { RATES, updateProgress } from "@/lib/tafsir/progress";
import { useLang } from "@/lib/ui";

/** 75 → "1:15", 3725 → "1:02:05" (Western digits, LTR). */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Thin progress line + times for the mini-player (recordings only). */
export function MiniProgress() {
  const snap = usePlayer();
  if (!snap.station?.onDemand) return null;
  const pct = snap.duration > 0 ? Math.min(100, (snap.position / snap.duration) * 100) : 0;
  return (
    <div className="mini-progress" aria-hidden>
      <span className="mini-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      <bdi dir="ltr" className="mini-time">
        {fmtClock(snap.position)}
        {snap.duration ? ` / ${fmtClock(snap.duration)}` : ""}
      </bdi>
    </div>
  );
}

/** Full controls for recordings: timeline, ±10 s, previous/next episode, stop, speed, repeat. */
export function OnDemandPanel() {
  const snap = usePlayer();
  const lang = useLang();
  const ar = lang === "ar";
  const [drag, setDrag] = useState<number | null>(null);
  if (!snap.station?.onDemand) return null;
  const e = player().engine;
  const pos = drag ?? snap.position;
  const dur = snap.duration;
  const commit = () => {
    if (drag !== null) e.seekTo(drag);
    setDrag(null);
  };
  const setRate = (r: number) => {
    e.setRate(r);
    updateProgress((p) => ({ ...p, rate: r }));
  };
  const setRepeat = (m: RepeatMode) => {
    e.setRepeat(m);
    updateProgress((p) => ({ ...p, repeat: m }));
  };
  const first = snap.streamIndex === 0;
  const last = snap.streamIndex >= snap.streamCount - 1;
  const loops = snap.repeat === "all";

  return (
    <div className="ondemand">
      <div className="timeline" dir="ltr">
        <input
          type="range"
          min={0}
          max={Math.max(1, dur)}
          step={1}
          value={Math.min(pos, Math.max(1, dur))}
          disabled={!dur}
          onChange={(ev) => setDrag(Number(ev.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          onBlur={commit}
          aria-label={ar ? "موضع التشغيل" : "Position"}
          aria-valuetext={`${fmtClock(pos)} / ${fmtClock(dur)}`}
          style={{ ["--pct" as string]: `${dur ? (pos / dur) * 100 : 0}%` }}
        />
        <div className="times" dir="ltr">
          <span>{fmtClock(pos)}</span>
          <span>{dur ? fmtClock(dur) : "--:--"}</span>
        </div>
      </div>

      <div className="od-row" dir="ltr">
        <button className="icon-btn icon-lg" onClick={() => player().step(-1)} disabled={first && !loops} aria-label={ar ? "الحلقة السابقة" : "Previous episode"} title={ar ? "الحلقة السابقة" : "Previous episode"}>
          <Icon name="prev" size={26} />
        </button>
        <button className="seek-btn" onClick={() => e.seekBy(-10)} aria-label={ar ? "رجوع 10 ثوانٍ" : "Back 10 seconds"}>
          <span dir="ltr">−10</span>
        </button>
        <PlayToggle />
        <button className="seek-btn" onClick={() => e.seekBy(10)} aria-label={ar ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}>
          <span dir="ltr">+10</span>
        </button>
        <button className="icon-btn icon-lg" onClick={() => player().step(1)} disabled={last && !loops} aria-label={ar ? "الحلقة التالية" : "Next episode"} title={ar ? "الحلقة التالية" : "Next episode"}>
          <Icon name="next" size={26} />
        </button>
      </div>

      <div className="od-options">
        <div className="seg" role="group" aria-label={ar ? "سرعة التشغيل" : "Playback speed"}>
          {RATES.map((r) => (
            <button key={r} className={snap.rate === r ? "on" : ""} aria-pressed={snap.rate === r} onClick={() => setRate(r)}>
              <bdi dir="ltr">{r}×</bdi>
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={ar ? "التكرار" : "Repeat"}>
          {(
            [
              ["off", ar ? "التالي تلقائيًا" : "Auto next"],
              ["one", ar ? "تكرار الحلقة" : "Repeat episode"],
              ["all", ar ? "تكرار السورة" : "Repeat list"],
            ] as [RepeatMode, string][]
          ).map(([m, label]) => (
            <button key={m} className={snap.repeat === m ? "on" : ""} aria-pressed={snap.repeat === m} onClick={() => setRepeat(m)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={() => player().stop()}>
          <Icon name="stop" size={16} /> {ar ? "إيقاف" : "Stop"}
        </button>
      </div>
      {snap.status === "completed" && <p className="hint">{ar ? "اكتملت حلقات هذه القائمة. اضغط تشغيل للبدء من أولها." : "This list is finished. Press play to start again."}</p>}
    </div>
  );
}

function PlayToggle() {
  const snap = usePlayer();
  const ar = useLang() === "ar";
  const active = snap.status === "playing" || snap.status === "buffering" || snap.status === "connecting";
  const busy = snap.status === "buffering" || snap.status === "connecting";
  return (
    <button className={`play-btn play-lg ${busy ? "is-busy" : ""}`} onClick={() => player().toggle()} aria-label={active ? (ar ? "إيقاف مؤقت" : "Pause") : snap.status === "paused" ? (ar ? "استئناف" : "Resume") : ar ? "تشغيل" : "Play"}>
      <span className="play-ring" aria-hidden />
      <Icon name={active && !busy ? "pause" : busy ? "pause" : "play"} size={34} />
    </button>
  );
}
