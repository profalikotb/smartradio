"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CoreButton, StationRow } from "@/components/Stations";
import { CORE_IDS } from "@/lib/catalog";
import { player, useController, usePlayer } from "@/lib/player/controller";
import { useAppState } from "@/lib/store";
import { displayName, viewOf } from "@/lib/stations";
import { fmtDate } from "@/lib/i18n";
import { useLang, useMounted, useT } from "@/lib/ui";

export default function Home() {
  const t = useT();
  const lang = useLang();
  const mounted = useMounted();
  const pinned = useAppState((s) => s.pinned);
  const favorites = useAppState((s) => s.favorites);
  const recent = useAppState((s) => s.recent);
  const lastId = useAppState((s) => s.settings.lastStationId);
  const nick = useAppState((s) => s.nicknames);
  const snap = usePlayer();
  const ctl = useController();

  const otherPinned = pinned.filter((id) => !(CORE_IDS as readonly string[]).includes(id));
  const lastView = lastId ? viewOf(lastId) : null;
  const showResume = mounted && lastView && !snap.station && !ctl.pendingId;

  return (
    <div className="page home">
      <section className="hero">
        <div className="dial" aria-hidden>
          <span className="dial-needle" />
        </div>
        <h1 className="greeting">{t.greeting}</h1>
        <p className="muted">{mounted ? fmtDate(Date.now()) : " "}</p>
      </section>

      {showResume && lastView && (
        <button className="resume-card" onClick={() => player().playById(lastView.id)}>
          <span>
            <span className="muted small">{t.lastStation}</span>
            <strong>{displayName(lastView, lang, nick)}</strong>
          </span>
          <span className="btn btn-gold btn-sm">
            <Icon name="play" size={16} /> {t.resume}
          </span>
        </button>
      )}

      <section aria-labelledby="core-h">
        <h2 id="core-h" className="section-title">{t.core}</h2>
        <div className="core-grid">
          {CORE_IDS.map((id) => (
            <CoreButton key={id} id={id} />
          ))}
        </div>
      </section>

      <div className="quick-links">
        <Link href="/focus" className="quick-link">
          <Icon name="quran" /> {t.focus}
        </Link>
        <Link href="/drive" className="quick-link">
          <Icon name="car" /> {t.drive}
        </Link>
        <Link href="/search" className="quick-link">
          <Icon name="search" /> {t.search}
        </Link>
      </div>

      {mounted && otherPinned.length > 0 && (
        <section aria-labelledby="pin-h">
          <h2 id="pin-h" className="section-title">{t.pinned}</h2>
          <ul className="station-list">
            {otherPinned.map((id) => (
              <StationRow key={id} id={id} />
            ))}
          </ul>
        </section>
      )}

      {mounted && (
        <section aria-labelledby="fav-h">
          <h2 id="fav-h" className="section-title">
            {t.favorites}
            <Link href="/favorites" className="link-sm">{lang === "ar" ? "إدارة" : "Manage"}</Link>
          </h2>
          {favorites.length ? (
            <ul className="station-list">
              {favorites.slice(0, 8).map((id) => (
                <StationRow key={id} id={id} />
              ))}
            </ul>
          ) : (
            <p className="muted">{t.empty}</p>
          )}
        </section>
      )}

      {mounted && recent.length > 0 && (
        <section aria-labelledby="rec-h">
          <h2 id="rec-h" className="section-title">{t.recent}</h2>
          <ul className="station-list">
            {recent.slice(0, 6).map((r) => (
              <StationRow key={r.id} id={r.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
