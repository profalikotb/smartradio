"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Stations";
import { player, useController, usePlayer } from "@/lib/player/controller";
import type { PlayerSnapshot } from "@/lib/player/engine";
import { useAppState, update } from "@/lib/store";
import { fmt, fmtTime, type Dict } from "@/lib/i18n";
import { useLang, useT, useTicker } from "@/lib/ui";
import { displayName, viewOf } from "@/lib/stations";
import { MiniProgress, OnDemandPanel } from "./OnDemand";
import { toggleFavorite } from "@/lib/state";

export type UiStatus = PlayerSnapshot["status"] | "resolving" | "resolve-failed";

export function useUiStatus(): { status: UiStatus; snap: PlayerSnapshot; stationId?: string; message?: string } {
  const snap = usePlayer();
  const ctl = useController();
  const t = useT();
  if (ctl.pendingId) return { status: "resolving", snap, stationId: ctl.pendingId };
  if (ctl.resolveError) return { status: "resolve-failed", snap, stationId: ctl.resolveError.id, message: t.resolve[ctl.resolveError.reason] };
  const message = snap.error && (snap.status === "unavailable" || snap.status === "offline" || snap.needsTap || snap.status === "buffering") ? t.errors[snap.error] : undefined;
  return { status: snap.status, snap, stationId: snap.station?.id, message };
}

export function statusLabel(s: UiStatus, t: Dict) {
  if (s === "resolving") return t.status.connecting;
  if (s === "resolve-failed") return t.status.unavailable;
  return t.status[s];
}

export const isActive = (s: UiStatus) => s === "playing" || s === "buffering" || s === "connecting" || s === "resolving";

export function PlayButton({ size = "md" }: { size?: "md" | "lg" | "xl" }) {
  const { status } = useUiStatus();
  const t = useT();
  const active = isActive(status);
  const busy = status === "connecting" || status === "resolving" || status === "buffering";
  return (
    <button
      className={`play-btn play-${size} ${busy ? "is-busy" : ""} ${status === "playing" ? "is-live" : ""}`}
      onClick={() => player().toggle()}
      aria-label={active ? (busy ? t.cancel : t.pause) : t.play}
    >
      <span className="play-ring" aria-hidden />
      <Icon name={active ? (busy ? "stop" : "pause") : "play"} size={size === "xl" ? 44 : size === "lg" ? 34 : 24} />
    </button>
  );
}

export function LiveBadge({ status }: { status: UiStatus }) {
  const t = useT();
  const lang = useLang();
  // Recitation playlists play recordings, not a live broadcast.
  const st = usePlayer().station;
  const recorded = st?.playlist || st?.onDemand;
  if (status !== "playing") return null;
  const music = st?.category === "music";
  const label = recorded ? (lang === "ar" ? (music ? "تسجيل" : "تلاوة") : music ? "Recording" : "Recitation") : t.live;
  return (
    <span className="live-badge" aria-label={label}>
      <span className="live-dot" aria-hidden /> {label}
    </span>
  );
}

function RetryLine() {
  const { status, snap, message } = useUiStatus();
  const t = useT();
  useTicker(!!snap.retryAt);
  if (!message && !snap.retryAt) return null;
  const secs = snap.retryAt ? Math.max(0, Math.ceil((snap.retryAt - Date.now()) / 1000)) : 0;
  const showRetry = status === "unavailable" || status === "resolve-failed" || status === "offline" || (status === "buffering" && snap.retryAt) || snap.needsTap;
  return (
    <div className="retry-line" role="status" aria-live="polite">
      <span>
        {message}
        {snap.retryAt ? ` · ${fmt(t.retryIn, { n: secs })} · ${fmt(t.attempt, { n: snap.attempt })}` : ""}
      </span>
      {showRetry && (
        <span className="retry-actions">
          <button className="btn btn-sm btn-gold" onClick={() => player().retry()}>
            <Icon name="retry" size={16} /> {t.retry}
          </button>
          {(status === "buffering" || status === "offline") && (
            <button className="btn btn-sm" onClick={() => player().stop()}>
              {t.cancel}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function BottomPlayer({ hidden }: { hidden?: boolean }) {
  const ui = useUiStatus();
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  const favorites = useAppState((s) => s.favorites);
  const lastId = useAppState((s) => s.settings.lastStationId);
  const [open, setOpen] = useState(false);

  // One-tap return: show the last station (selected, NOT playing) after relaunch.
  const id = ui.stationId ?? lastId;
  const view = id ? viewOf(id) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;
  const fav = id ? favorites.includes(id) : false;

  return (
    <>
      <section className={`bottom-player ${view ? "" : "is-empty"}`} aria-label="Player">
        <button className="bp-info" onClick={() => view && setOpen(true)} disabled={!view} aria-label={t.details}>
          <Logo id={id} size={44} />
          <span className="bp-text">
            <span className="bp-name">{view ? displayName(view, lang, nick) : t.selectStation}</span>
            <span className={`bp-status st-${ui.status}`}>
              <LiveBadge status={ui.status} />
              {ui.status !== "playing" && statusLabel(ui.status, t)}
              {ui.status === "playing" && <span className="muted"> {ui.snap.station?.playlist && ui.snap.stream?.label ? ui.snap.stream.label : t.liveBroadcast}</span>}
            </span>
          </span>
        </button>
        <div className="bp-controls">
          {view && (
            <button className={`icon-btn ${fav ? "is-on" : ""}`} onClick={() => id && update((s) => toggleFavorite(s, id))} aria-label={fav ? t.removeFav : t.addFav} aria-pressed={fav}>
              <Icon name="star" />
            </button>
          )}
          <PlayButton />
        </div>
        <MiniProgress />
        <RetryLine />
      </section>
      {open && view && <PlayerSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function PlayerSheet({ onClose }: { onClose: () => void }) {
  const ui = useUiStatus();
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  const id = ui.stationId ?? "";
  const view = viewOf(id);
  const onDemand = !!ui.snap.station?.onDemand;
  if (!view) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={displayName(view, lang, nick)} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="×">
          <Icon name="close" />
        </button>
        <div className="sheet-head">
          <Logo id={id} size={88} />
          <h2 className="sheet-title">{displayName(view, lang, nick)}</h2>
          <p className="muted">
            {view.frequency ? `${view.frequency} · ` : ""}
            {view.country === "EG" ? (lang === "ar" ? "مصر" : "Egypt") : view.country}
          </p>
          <p className={`sheet-status st-${ui.status}`}>
            <LiveBadge status={ui.status} /> {ui.status === "playing" ? (ui.snap.station?.playlist && ui.snap.stream?.label ? ui.snap.stream.label : t.liveBroadcast) : statusLabel(ui.status, t)}
          </p>
        </div>
        {onDemand ? (
          <OnDemandPanel />
        ) : (
          <div className="sheet-controls">
            <button className="icon-btn icon-lg" onClick={() => player().step(-1)} aria-label={t.previous}>
              <Icon name={lang === "ar" ? "next" : "prev"} size={28} />
            </button>
            <PlayButton size="lg" />
            <button className="icon-btn icon-lg" onClick={() => player().step(1)} aria-label={t.next}>
              <Icon name={lang === "ar" ? "prev" : "next"} size={28} />
            </button>
          </div>
        )}
        <RetryLine />
        <VolumeControl />
        <SleepTimer />
        {!onDemand && <ConnectionPanel />}
        {id.startsWith("umm:") ? (
          <Link href={id === "umm:all" ? "/umm?mode=radio" : `/umm/${id.slice(6)}`} className="btn btn-block" onClick={onClose}>
            <Icon name="music" size={18} /> {lang === "ar" ? "تسجيلات الأغنية" : "Song versions"}
          </Link>
        ) : id.startsWith("tafsir:") ? (
          <Link href={id === "tafsir:all" ? "/tafsir?mode=radio" : `/tafsir/${id.slice(7)}`} className="btn btn-block" onClick={onClose}>
            <Icon name="quran" size={18} /> {lang === "ar" ? "قائمة الحلقات" : "Episode list"}
          </Link>
        ) : (
          <Link href={`/station/${encodeURIComponent(id)}`} className="btn btn-block" onClick={onClose}>
            <Icon name="info" size={18} /> {t.details}
          </Link>
        )}
      </div>
    </div>
  );
}

export function VolumeControl() {
  const snap = usePlayer();
  const t = useT();
  if (!snap.volumeSupported) return <p className="hint">{t.volumeDevice}</p>;
  return (
    <label className="row volume">
      <Icon name="volume" size={20} />
      <span className="sr-only">{t.volume}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={snap.volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          player().engine.setVolume(v);
          update((s) => ({ ...s, settings: { ...s.settings, volume: v } }));
        }}
      />
    </label>
  );
}

export function SleepTimer() {
  const snap = usePlayer();
  const t = useT();
  const lang = useLang();
  const fade = useAppState((s) => s.settings.fadeOnSleep);
  const [custom, setCustom] = useState("");
  const start = (m: number) => player().engine.startSleep(m, fade);
  return (
    <fieldset className="panel">
      <legend>
        <Icon name="timer" size={18} /> {t.sleep}
      </legend>
      {snap.sleepEndsAt ? (
        <div className="row between">
          <span>{fmt(t.sleepEnds, { t: fmtTime(snap.sleepEndsAt, lang) })}</span>
          <button className="btn btn-sm" onClick={() => player().engine.cancelSleep()}>
            {t.sleepOff}
          </button>
        </div>
      ) : (
        <div className="chips">
          {[15, 30, 45, 60].map((m) => (
            <button key={m} className="chip-btn" onClick={() => start(m)}>
              {m} {t.minutes}
            </button>
          ))}
          <form
            className="custom-min"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(custom);
              if (n >= 1 && n <= 600) start(n);
            }}
          >
            <input inputMode="numeric" pattern="[0-9]*" placeholder={t.custom} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label={`${t.custom} (${t.minutes})`} />
            <button className="chip-btn" type="submit" disabled={!custom}>
              ✓
            </button>
          </form>
        </div>
      )}
      <label className="row check">
        <input type="checkbox" checked={fade} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, fadeOnSleep: e.target.checked } }))} />
        {t.fade}
      </label>
      <p className="hint">{t.sleepNote}</p>
    </fieldset>
  );
}

export function ConnectionPanel() {
  const snap = usePlayer();
  const ui = useUiStatus();
  const t = useT();
  const kbps = snap.stream?.bitrate;
  const mb = kbps ? (kbps * 1000 * snap.listenedSeconds) / 8 / 1_000_000 : undefined;
  const mins = Math.floor(snap.listenedSeconds / 60);
  return (
    <fieldset className="panel">
      <legend>{t.connection}</legend>
      <dl className="kv">
        <dt>{t.state}</dt>
        <dd>{statusLabel(ui.status, t)}</dd>
        <dt>{t.bitrate}</dt>
        <dd>{kbps ? `${kbps} kbps` : t.unknown}{snap.stream?.codec ? ` · ${snap.stream.codec}` : ""}</dd>
        <dt>{t.listened}</dt>
        <dd>{mins} {t.minutes}</dd>
        <dt>{t.dataUse}</dt>
        <dd>{mb !== undefined ? `≈ ${mb.toFixed(1)} MB` : t.unknown}</dd>
        {snap.streamCount > 1 && (
          <>
            <dt>{t.alternatives}</dt>
            <dd>{fmt(t.altStream, { i: snap.streamIndex + 1, n: snap.streamCount })}</dd>
          </>
        )}
      </dl>
    </fieldset>
  );
}
