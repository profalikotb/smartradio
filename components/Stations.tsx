"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { player } from "@/lib/player/controller";
import { useAppState, update } from "@/lib/store";
import { displayName, viewOf, type StationView } from "@/lib/stations";
import { togglePin, toggleFavorite } from "@/lib/state";
import { useLang, useT } from "@/lib/ui";
import { isActive, LiveBadge, statusLabel, useUiStatus } from "./Player";
import { fmtDateTime } from "@/lib/i18n";
import type { Category } from "@/lib/types";

const CAT_ICON: Record<Category, string> = {
  quran: "quran",
  religious: "quran",
  news: "radio",
  culture: "info",
  sports: "radio",
  music: "music",
  regional: "globe",
  general: "radio",
};

/** Real logo when the directory supplies one; otherwise a typographic monogram — never a fake logo. */
export function Logo({ id, size = 48 }: { id?: string; size?: number }) {
  const known = useAppState((s) => (id ? s.known[id] : undefined));
  const lang = useLang();
  const [broken, setBroken] = useState(false);
  const v = id ? viewOf(id) : null;
  const logo = known?.logo;
  const style = { width: size, height: size };
  if (logo && !broken)
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="logo" src={logo} alt="" width={size} height={size} style={style} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  const name = v ? (lang === "ar" ? v.nameAr : v.nameEn) : "";
  const letter = (name.replace(/^(إذاعة|اذاعة|راديو|radio)\s+/i, "").replace(/^ال/, "").trim()[0] ?? "♪").toUpperCase();
  return (
    <span className={`logo logo-fallback cat-${v?.category ?? "general"}`} style={style} aria-hidden>
      {v && (v.category === "quran" || v.category === "music") ? <Icon name={CAT_ICON[v.category]} size={Math.round(size * 0.46)} /> : <span style={{ fontSize: size * 0.42 }}>{letter}</span>}
    </span>
  );
}

export function IdentityBadge({ v }: { v: Pick<StationView, "identity"> }) {
  const t = useT();
  if (v.identity === "catalog-verified")
    return (
      <span className="badge badge-ok" title={t.verified}>
        <Icon name="shield" size={14} /> {t.verified}
      </span>
    );
  if (v.identity === "user-confirmed") return <span className="badge badge-user">{t.userConfirmed}</span>;
  return <span className="badge badge-warn">{t.unverified}</span>;
}

/** Status of a given station, combining live player state, lookup state and this-device history. */
export function useStationStatus(id: string) {
  const ui = useUiStatus();
  const info = useAppState((s) => s.playback[id]);
  const current = ui.stationId === id;
  return { current, ui: current ? ui : null, info };
}

export function CoreButton({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  useAppState((s) => s.bindings[id]); // re-render when a stream gets bound
  const v = viewOf(id);
  const { current, ui, info } = useStationStatus(id);
  if (!v) return null;
  const active = current && ui && isActive(ui.status);
  const failed = current && ui && (ui.status === "unavailable" || ui.status === "resolve-failed");
  const unverifiedNoStream = v.identity === "unverified";
  return (
    <div className={`core-card cat-${v.category} ${active ? "is-active" : ""} ${failed ? "is-failed" : ""}`}>
      <button
        className="core-main"
        onClick={() => (active ? player().stop() : player().playById(id))}
        aria-label={`${active ? t.stop : t.play}: ${displayName(v, lang, nick)}`}
      >
        <Logo id={id} size={56} />
        <span className="core-text">
          <span className="core-name">{displayName(v, lang, nick)}</span>
          <span className="core-meta">
            {current && ui ? (
              <>
                <LiveBadge status={ui.status} /> {ui.status === "playing" ? t.liveBroadcast : statusLabel(ui.status, t)}
              </>
            ) : unverifiedNoStream ? (
              t.unverified
            ) : (
              <>{v.frequency ?? t.categories[v.category]}</>
            )}
          </span>
        </span>
        <span className="core-play" aria-hidden>
          <Icon name={active ? "stop" : "play"} size={30} />
        </span>
      </button>
      {(failed || (!current && info?.lastError && !info.lastOkAt) || unverifiedNoStream) && (
        <div className="core-foot">
          <span className="muted small">
            {current && ui?.message ? ui.message : unverifiedNoStream ? t.resolve.unverified : info?.lastErrorAt ? `${t.status.unavailable} · ${fmtDateTime(info.lastErrorAt, lang)}` : ""}
          </span>
          <span className="row gap-s">
            <button className="btn btn-sm btn-gold" onClick={() => (current ? player().retry() : player().playById(id))}>
              <Icon name="retry" size={16} /> {t.retry}
            </button>
            {unverifiedNoStream && (
              <Link href={`/station/${encodeURIComponent(id)}`} className="btn btn-sm">
                {t.findStream}
              </Link>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export function StationRow({ id, view, extra, onPlay, onRemember }: { id: string; view?: StationView | null; extra?: React.ReactNode; onPlay?: () => void; onRemember?: () => void }) {
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  const fav = useAppState((s) => s.favorites.includes(id));
  const pinned = useAppState((s) => s.pinned.includes(id));
  const v = view ?? viewOf(id);
  const { current, ui } = useStationStatus(id);
  if (!v) return null;
  const active = current && ui && isActive(ui.status);
  return (
    <li className={`station-row ${active ? "is-active" : ""}`}>
      <button className="sr-main" onClick={() => (onPlay ? onPlay() : active ? player().stop() : player().playById(id))} aria-label={`${active ? t.stop : t.play}: ${displayName(v, lang, nick)}`}>
        <Logo id={id} size={44} />
        <span className="sr-text">
          <span className="sr-name">{displayName(v, lang, nick)}</span>
          <span className="sr-meta">
            {current && ui ? (
              <>
                <LiveBadge status={ui.status} /> {ui.status === "playing" ? t.liveBroadcast : statusLabel(ui.status, t)}
              </>
            ) : (
              <>
                <IdentityBadge v={v} /> <span className="muted">{t.categories[v.category]}</span>
              </>
            )}
          </span>
        </span>
      </button>
      <span className="sr-actions">
        {extra}
        <button className={`icon-btn ${fav ? "is-on" : ""}`} onClick={() => (onRemember?.(), update((s) => toggleFavorite(s, id)))} aria-label={fav ? t.removeFav : t.addFav} aria-pressed={fav}>
          <Icon name="star" />
        </button>
        <button className={`icon-btn ${pinned ? "is-on" : ""}`} onClick={() => (onRemember?.(), update((s) => togglePin(s, id)))} aria-label={pinned ? t.unpin : t.pin} aria-pressed={pinned}>
          <Icon name="pin" />
        </button>
        <Link className="icon-btn" href={`/station/${encodeURIComponent(id)}`} aria-label={t.details} onClick={() => onRemember?.()}>
          <Icon name="info" />
        </Link>
      </span>
    </li>
  );
}
