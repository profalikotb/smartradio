"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AddStationForm } from "@/components/AddStation";
import { useState } from "react";
import { CoreButton, StationRow } from "@/components/Stations";
import { CATALOG } from "@/lib/catalog";
import { CoreEditor } from "@/components/CoreEditor";
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
  const [adding, setAdding] = useState(false);
  const [editCore, setEditCore] = useState(false);
  const core = useAppState((s) => s.core);
  const ctl = useController();

  const otherPinned = pinned.filter((id) => !core.includes(id));
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
        <h2 id="core-h" className="section-title">
          {t.core}
          {mounted && (
            <button className={`btn btn-sm ${editCore ? "btn-gold" : ""}`} onClick={() => setEditCore((e) => !e)} aria-expanded={editCore}>
              <Icon name={editCore ? "close" : "edit"} size={14} /> {editCore ? t.doneEdit : t.editCore}
            </button>
          )}
        </h2>
        <div className="core-grid">
          {core.map((id) => (
            <CoreButton key={id} id={id} editing={editCore} />
          ))}
        </div>
        {mounted && core.length === 0 && !editCore && <p className="muted">{t.coreEmpty}</p>}
        {mounted && editCore && <CoreEditor />}
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

      <section aria-labelledby="eg-h">
        <h2 id="eg-h" className="section-title">
          {lang === "ar" ? "المحطات المصرية" : "Egyptian stations"}
          <button className="btn btn-sm btn-gold" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Icon name={adding ? "close" : "plus"} size={14} /> {t.addStation}
          </button>
        </h2>
        {adding && (
          <div className="panel">
            <AddStationForm onDone={() => setAdding(false)} />
          </div>
        )}
        <ul className="station-list">
          {CATALOG.filter((c) => !core.includes(c.id))
            .sort((a, b) => Number(b.identity.status === "catalog-verified") - Number(a.identity.status === "catalog-verified"))
            .map((c) => (
              <StationRow key={c.id} id={c.id} />
            ))}
        </ul>
      </section>

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
