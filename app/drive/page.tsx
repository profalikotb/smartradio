"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { isActive, LiveBadge, statusLabel, useUiStatus } from "@/components/Player";
import { player } from "@/lib/player/controller";
import { useAppState } from "@/lib/store";
import { displayName, viewOf } from "@/lib/stations";
import { useLang, useMounted, useT } from "@/lib/ui";

export default function DrivePage() {
  const t = useT();
  const lang = useLang();
  const mounted = useMounted();
  const favorites = useAppState((s) => s.favorites);
  const core = useAppState((s) => s.core);
  const hidden = useAppState((s) => s.hidden);
  const nick = useAppState((s) => s.nicknames);
  const ui = useUiStatus();
  // Core stations first (user order), then the rest of the favorites in the user's order.
  const ids = [...core, ...favorites.filter((id) => !core.includes(id))].filter((id) => !hidden.includes(id)).slice(0, 8);
  const active = isActive(ui.status);

  return (
    <div className="drive">
      <div className="drive-top">
        <Link href="/" className="btn btn-sm">
          <Icon name="close" size={16} /> {t.exitFocus}
        </Link>
        <span className={`drive-status st-${ui.status}`} role="status" aria-live="polite">
          <LiveBadge status={ui.status} /> {ui.stationId ? `${displayName(viewOf(ui.stationId) ?? { id: "", nameAr: "", nameEn: "" }, lang, nick)} · ` : ""}
          {ui.status === "playing" ? t.liveBroadcast : statusLabel(ui.status, t)}
        </span>
      </div>
      <div className="drive-grid">
        {mounted &&
          ids.map((id) => {
            const v = viewOf(id);
            if (!v) return null;
            const cur = ui.stationId === id;
            return (
              <button key={id} className={`drive-btn cat-${v.category} ${cur && active ? "is-active" : ""} ${cur && (ui.status === "unavailable" || ui.status === "resolve-failed") ? "is-failed" : ""}`} onClick={() => (cur && active ? player().stop() : player().playById(id))}>
                <span className="drive-name">{displayName(v, lang, nick)}</span>
                <Icon name={cur && active ? "stop" : "play"} size={36} />
              </button>
            );
          })}
      </div>
      {ui.message && (
        <div className="drive-msg">
          <span>{ui.message}</span>
          <button className="btn btn-gold" onClick={() => player().retry()}>
            <Icon name="retry" size={18} /> {t.retry}
          </button>
        </div>
      )}
      <div className="drive-controls">
        <button className="drive-ctl" onClick={() => player().step(-1)} aria-label={t.previous}>
          <Icon name={lang === "ar" ? "next" : "prev"} size={40} />
        </button>
        <button className="drive-ctl drive-ctl-main" onClick={() => player().toggle()} aria-label={active ? t.pause : t.play}>
          <Icon name={active ? "pause" : "play"} size={48} />
        </button>
        <button className="drive-ctl" onClick={() => player().step(1)} aria-label={t.next}>
          <Icon name={lang === "ar" ? "prev" : "next"} size={40} />
        </button>
      </div>
    </div>
  );
}
