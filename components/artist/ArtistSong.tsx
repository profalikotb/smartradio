"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { player, usePlayer } from "@/lib/player/controller";
import { clientFor } from "@/lib/umm/client";
import type { ArtistSlug } from "@/lib/umm/artists";
import { resumePosition, toggleFavId } from "@/lib/tafsir/progress";
import { arCount, clock, ddmmyyyy, REC } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

/** One song of a singer: every version (studio, dated concerts), each with its own saved position. */
export function ArtistSong({ slug, songKey: key }: { slug: ArtistSlug; songKey: string }) {
  const c = clientFor(slug);
  const A = c.artist;
  const ar = useLang() === "ar";
  const mounted = useMounted();
  const { library, status } = c.useLibrary();
  const progress = c.store.use((p) => p);
  const snap = usePlayer();

  const song = library ? c.songByKey(library, key) : undefined;
  const station = song ? c.songStation(song) : null;
  const here = snap.station?.id === `${A.prefix}s:${key}`;
  const fav = progress.favIds.includes(key);

  return (
    <div className="page tafsir-surah umm-song">
      <nav className="crumbs">
        <Link href={A.route}>{ar ? "← كل الأغاني" : "← All songs"}</Link>
      </nav>

      {status === "loading" && !library && <p className="banner">{ar ? "جارٍ تحميل المكتبة…" : "Loading…"}</p>}
      {status === "error" && !library && (
        <p className="banner banner-warn" role="alert">
          {ar ? "تعذّر تحميل المكتبة من المصدر الآن." : "Couldn't load the library."}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => c.loadLibrary(true)}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </p>
      )}
      {library && !song && (
        <section className="panel empty-surah" role="status">
          <h2 className="section-title">{ar ? "الأغنية غير موجودة في المكتبة الحالية" : "Song not found"}</h2>
          <Link href={A.route} className="btn">{ar ? "كل الأغاني" : "All songs"}</Link>
        </section>
      )}

      {song && station && (
        <>
          <header className="surah-head">
            <span className="surah-num big umm-num" aria-hidden>♪</span>
            <div className="surah-head-text">
              <h1 className="page-title" dir={song.arabic ? "rtl" : "ltr"}>{song.title}</h1>
              <p className="muted">{ar ? `${A.nameAr} · ${arCount(song.versions.length, REC)}` : `${A.nameEn} · ${song.versions.length} versions`}</p>
            </div>
            <button className={`icon-btn ${fav ? "is-on" : ""}`} aria-pressed={fav} aria-label={ar ? "المفضلة" : "Favorite"} onClick={() => c.store.update((p) => toggleFavId(p, key))}>
              <Icon name="star" />
            </button>
          </header>

          <div className="row gap-s wrap surah-actions">
            <button className="btn btn-gold" onClick={() => c.playVersion(station, Math.max(0, song.versions.findIndex((v) => !progress.episodes[v.id]?.done)))}>
              <Icon name="play" size={18} /> {song.versions.length > 1 ? (ar ? "تشغيل كل التسجيلات" : "Play all versions") : ar ? "تشغيل" : "Play"}
            </button>
          </div>

          <ol className="episode-list">
            {song.versions.map((v, i) => {
              const pr = progress.episodes[v.id];
              const current = here && snap.streamIndex === i;
              const playing = current && (snap.status === "playing" || snap.status === "buffering" || snap.status === "connecting");
              const pos = current ? snap.position : pr?.pos ?? 0;
              const dur = (current ? snap.duration : 0) || pr?.dur || v.duration;
              const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
              const resumeAt = mounted ? resumePosition(c.store.get(), v.id) : 0;
              return (
                <li key={v.id} className={`episode ${current ? "is-current" : ""} ${pr?.done ? "is-done" : ""}`}>
                  <button className="ep-play" onClick={() => (current ? player().toggle() : c.playVersion(station, i))} aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause") : `${ar ? "تشغيل" : "Play"} ${v.label}`}>
                    <Icon name={playing ? "pause" : "play"} size={22} />
                  </button>
                  <div className="ep-main">
                    <strong className="ep-title">{v.label}</strong>
                    <span className="ep-meta">
                      {dur ? <bdi dir="ltr">{clock(dur)}</bdi> : null}
                      {dur ? " · " : ""}
                      <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="src-link">
                        {v.sourceName.replace(/^Internet Archive — /, "")}
                      </a>
                    </span>
                    <span className="ep-state">
                      {pr?.done ? (
                        <span className="ok">{ar ? "✓ استمعت إليها كاملة" : "✓ Heard in full"}</span>
                      ) : resumeAt > 0 && !current ? (
                        <span>
                          {ar ? "توقفت عند " : "Stopped at "}
                          <bdi dir="ltr">{clock(resumeAt)}</bdi>
                          {pr?.at ? <> · <bdi dir="ltr">{ddmmyyyy(pr.at)}</bdi></> : null}
                        </span>
                      ) : null}
                      {current && snap.status === "buffering" && <span>{ar ? "جارٍ التحميل…" : "Buffering…"}</span>}
                      {current && snap.status === "unavailable" && <span className="err">{ar ? "تعذّر تشغيل هذا الملف من المصدر." : "This file couldn't be played."}</span>}
                      {!current && pr?.failAt && !pr.okAt && <span className="err">{ar ? "تعذّر تشغيله سابقًا على هذا الجهاز" : "Failed on this device before"}</span>}
                    </span>
                    {(pct > 0 || current) && (
                      <span className="ep-bar" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </div>
                  {resumeAt > 0 && !current && (
                    <button className="btn btn-sm ep-restart" onClick={() => c.playVersion(station, i, { fromStart: true })}>
                      {ar ? "من البداية" : "Restart"}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="hint source-note">{ar ? "التسجيلات ملفات منشورة للعامة على Internet Archive. حالة التشغيل تُسجَّل عند الاستماع الفعلي على هذا الجهاز." : "Public files on the Internet Archive."}</p>
        </>
      )}
    </div>
  );
}
