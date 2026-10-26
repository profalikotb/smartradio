"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import { player } from "@/lib/player/controller";
import { getState, useAppState, update } from "@/lib/store";
import { catalogById } from "@/lib/catalog";
import { displayName, viewOf, type StationView } from "@/lib/stations";
import { deleteStation, moveCore, toggleCore, togglePin, toggleFavorite } from "@/lib/state";
import { useLang, useT } from "@/lib/ui";
import { isActive, LiveBadge, statusLabel, useUiStatus } from "./Player";
import { fmt, fmtDateTime } from "@/lib/i18n";
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
    return <img className="logo" src={logo} alt="" width={size} height={size} style={style} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} onLoad={(e) => e.currentTarget.naturalWidth < 16 && setBroken(true)} />;
  const name = v ? (lang === "ar" ? v.nameAr : v.nameEn) : "";
  const letter = (name.replace(/^(إذاعة|اذاعة|راديو|radio)\s+/i, "").replace(/^ال/, "").trim()[0] ?? "♪").toUpperCase();
  return (
    <span className={`logo logo-fallback cat-${v?.category ?? "general"}`} style={style} aria-hidden>
      {v && (v.category === "quran" || v.category === "religious" || v.category === "music") ? <Icon name={CAT_ICON[v.category]} size={Math.round(size * 0.46)} /> : <span style={{ fontSize: size * 0.42 }}>{letter}</span>}
    </span>
  );
}

/** Has a stream link (Excel list, replaced on this device, or found automatically for tribute stations). */
export function hasStream(id: string): boolean {
  const c = catalogById.get(id);
  return !!(c?.directStreams?.length || c?.playlist || c?.archive || c?.match?.anyCountry || getState().streamOverrides[id]);
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

export function CoreButton({ id, editing = false }: { id: string; editing?: boolean }) {
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  useAppState((s) => s.bindings[id]); // re-render when a stream gets bound
  const hidden = useAppState((s) => s.hidden.includes(id));
  const core = useAppState((s) => s.core);
  const v = viewOf(id);
  const { current, ui, info } = useStationStatus(id);
  if (!v || hidden || v.catalog?.section) return null;
  const pos = core.indexOf(id);
  const active = current && ui && isActive(ui.status);
  const failed = current && ui && (ui.status === "unavailable" || ui.status === "resolve-failed");
  const unverifiedNoStream = v.identity === "unverified" && !hasStream(id);
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
              <bdi dir="ltr">{v.frequency ?? t.categories[v.category]}</bdi>
            )}
          </span>
        </span>
        <span className="core-play" aria-hidden>
          <Icon name={active ? "stop" : "play"} size={30} />
        </span>
      </button>
      {editing && (
        <div className="core-edit">
          <button className="icon-btn" disabled={pos <= 0} onClick={() => update((s) => moveCore(s, id, -1))} aria-label={t.moveUp} title={t.moveUp}>
            <Icon name="up" />
          </button>
          <button className="icon-btn" disabled={pos < 0 || pos >= core.length - 1} onClick={() => update((s) => moveCore(s, id, 1))} aria-label={t.moveDown} title={t.moveDown}>
            <Icon name="down" />
          </button>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => update((s) => toggleCore(s, id))} title={t.removeFromCore} aria-label={t.removeFromCore}>
            <Icon name="close" size={14} /> {t.removeShort}
          </button>
          <button
            className="btn btn-sm btn-danger"
            title={t.deleteStation}
            aria-label={t.deleteStation}
            onClick={() => {
              const n = displayName(v, lang, nick);
              if (!confirm(fmt(id.startsWith("custom:") ? t.deleteConfirmCustom : t.deleteConfirm, { n }))) return;
              if (current) player().stop();
              update((s) => deleteStation(s, id));
            }}
          >
            <Icon name="trash" size={14} /> {t.deleteShort}
          </button>
        </div>
      )}
      {!editing && (failed || (!current && info?.lastError && !info.lastOkAt) || unverifiedNoStream) && (
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
  const hidden = useAppState((s) => s.hidden.includes(id));
  const v = view ?? viewOf(id);
  const { current, ui } = useStationStatus(id);
  if (!v || hidden || v.catalog?.section) return null;
  const active = current && ui && isActive(ui.status);
  const onMain = () => {
    if (onPlay) return onPlay();
    return active ? player().stop() : player().playById(id);
  };
  return (
    <li className={`station-row ${active ? "is-active" : ""}`}>
      <button className="sr-main" onClick={onMain} aria-label={`${active ? t.stop : t.play}: ${displayName(v, lang, nick)}`}>
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
                {!(v.identity === "unverified" && hasStream(id)) && <IdentityBadge v={v} />}{" "}
                <span className="muted">{t.categories[v.category]}</span>
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
        <button
          className="icon-btn icon-danger"
          aria-label={t.deleteStation}
          title={t.deleteStation}
          onClick={() => {
            const n = displayName(v, lang, nick);
            if (!confirm(fmt(id.startsWith("custom:") ? t.deleteConfirmCustom : t.deleteConfirm, { n }))) return;
            if (current) player().stop();
            onRemember?.();
            update((s) => deleteStation(s, id));
          }}
        >
          <Icon name="trash" />
        </button>
      </span>
    </li>
  );
}
