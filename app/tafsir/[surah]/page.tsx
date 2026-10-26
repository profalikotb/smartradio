"use client";
import Link from "next/link";
import { use } from "react";
import { Icon } from "@/components/Icon";
import { player, usePlayer } from "@/lib/player/controller";
import { loadManifest, playEpisode, surahStation, TAFSIR_PREFIX, useManifest } from "@/lib/tafsir/client";
import { getProgress, resumePosition, surahStats, toggleFavSurah, updateProgress, useProgress } from "@/lib/tafsir/progress";
import { surahName, type Episode } from "@/lib/tafsir/parse";
import { clock, ddmmyyyy, episodeOrdinal, episodesCount } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

export default function SurahPage({ params }: { params: Promise<{ surah: string }> }) {
  const { surah } = use(params);
  const n = Number(surah);
  const lang = useLang();
  const ar = lang === "ar";
  const mounted = useMounted();
  const { manifest, status } = useManifest();
  const progress = useProgress((p) => p);
  const snap = usePlayer();

  if (!Number.isInteger(n) || n < 0 || n > 114) {
    return (
      <div className="page">
        <p className="muted">{ar ? "رقم سورة غير صحيح." : "Invalid surah."}</p>
        <Link href="/tafsir" className="btn">{ar ? "كل السور" : "All surahs"}</Link>
      </div>
    );
  }

  const eps: Episode[] = (n === 0 ? manifest?.intro : manifest?.surahs[n]) ?? [];
  const station = manifest ? surahStation(manifest, n) : null;
  const stationId = `${TAFSIR_PREFIX}${n}`;
  const here = snap.station?.id === stationId;
  const stats = surahStats(progress, eps.map((e) => e.id));
  const fav = progress.favSurahs.includes(n);
  const title = n === 0 ? (ar ? "مقدمة التفسير" : "Introduction") : ar ? `سورة ${surahName(n)}` : `Surah ${n} · ${surahName(n)}`;
  // "Play all" starts at the first episode not yet finished.
  const firstOpen = Math.max(0, eps.findIndex((e) => !progress.episodes[e.id]?.done));

  return (
    <div className="page tafsir-surah">
      <nav className="crumbs">
        <Link href="/tafsir">{ar ? "← كل السور" : "← All surahs"}</Link>
      </nav>
      <header className="surah-head">
        <span className="surah-num big" dir="ltr">{n || "★"}</span>
        <div className="surah-head-text">
          <h1 className="page-title">{title}</h1>
          <p className="muted">
            {ar ? "تفسير فضيلة الشيخ محمد متولي الشعراوي" : "Tafsir by Sheikh Al-Sha'rawi"}
            {eps.length > 0 && ` · ${episodesCount(eps.length, lang)}`}
            {stats.done > 0 && (ar ? ` · مكتمل ${stats.done}` : ` · ${stats.done} done`)}
            {stats.started && ` · ${stats.percent}%`}
          </p>
          {stats.started && (
            <span className="surah-bar wide" aria-hidden>
              <span style={{ width: `${stats.percent}%` }} />
            </span>
          )}
        </div>
        {n > 0 && (
          <button className={`icon-btn ${fav ? "is-on" : ""}`} aria-pressed={fav} aria-label={ar ? "المفضلة" : "Favorite"} onClick={() => updateProgress((p) => toggleFavSurah(p, n))}>
            <Icon name="star" />
          </button>
        )}
      </header>

      {status === "loading" && !manifest && <p className="banner">{ar ? "جارٍ تحميل قائمة الحلقات…" : "Loading episodes…"}</p>}
      {status === "error" && !manifest && (
        <p className="banner banner-warn" role="alert">
          {ar ? "تعذّر تحميل قائمة الحلقات من المصدر الآن." : "Couldn't load the episode list."}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => loadManifest(true)}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </p>
      )}

      {manifest && eps.length === 0 && (
        <section className="panel empty-surah" role="status">
          <h2 className="section-title">{ar ? "لا يوجد تسجيل متاح" : "No recording available"}</h2>
          <p className="hint">
            {ar
              ? `لم نجد تسجيلًا صوتيًا لتفسير ${title} في المصادر المتاحة. لا نعرض زر تشغيل لحلقة غير موجودة.`
              : "No audio recording of this surah's tafsir was found in the available sources."}
          </p>
        </section>
      )}

      {station && eps.length > 0 && (
        <div className="row gap-s wrap surah-actions">
          <button className="btn btn-gold" onClick={() => playEpisode(station, firstOpen)}>
            <Icon name="play" size={18} /> {stats.started ? (ar ? "متابعة السورة" : "Continue surah") : ar ? "تشغيل كل الحلقات" : "Play all"}
          </button>
          {stats.started && (
            <button className="btn" onClick={() => playEpisode(station, 0, { fromStart: true })}>
              {ar ? "من الحلقة الأولى" : "From episode 1"}
            </button>
          )}
        </div>
      )}

      <ol className="episode-list">
        {eps.map((e, i) => {
          const pr = progress.episodes[e.id];
          const current = here && snap.streamIndex === i;
          const playing = current && (snap.status === "playing" || snap.status === "buffering" || snap.status === "connecting");
          const pos = current ? snap.position : pr?.pos ?? 0;
          const dur = (current ? snap.duration : 0) || pr?.dur || e.duration;
          const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
          const resumeAt = mounted ? resumePosition(getProgress(), e.id) : 0;
          return (
            <li key={e.id} className={`episode ${current ? "is-current" : ""} ${pr?.done ? "is-done" : ""}`}>
              <button
                className="ep-play"
                onClick={() => (current ? player().toggle() : station && playEpisode(station, i))}
                aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause") : ar ? `تشغيل ${episodeOrdinal(e.part)}` : `Play episode ${e.part}`}
              >
                <Icon name={playing ? "pause" : "play"} size={22} />
              </button>
              <div className="ep-main">
                <strong className="ep-title">{n === 0 ? e.title : episodeOrdinal(e.part, lang)}</strong>
                <span className="ep-meta">
                  {e.coversSurahs ? (ar ? `ملف يضم السور ${e.coversSurahs[0]}–${e.coversSurahs[1]}` : `One file for surahs ${e.coversSurahs[0]}–${e.coversSurahs[1]}`) : null}
                  {e.verseStart ? (ar ? `الآيات ${e.verseStart}–${e.verseEnd ?? e.verseStart}` : `Verses ${e.verseStart}–${e.verseEnd ?? e.verseStart}`) : null}
                  {dur ? (
                    <>
                      {(e.verseStart || e.coversSurahs) && " · "}
                      <bdi dir="ltr">{clock(dur)}</bdi>
                    </>
                  ) : null}
                </span>
                <span className="ep-state">
                  {pr?.done ? (
                    <span className="ok">{ar ? "✓ مكتملة" : "✓ Completed"}</span>
                  ) : resumeAt > 0 && !current ? (
                    <span>
                      {ar ? "توقفت عند " : "Stopped at "}
                      <bdi dir="ltr">{clock(resumeAt)}</bdi>
                      {pr?.at ? <> · <bdi dir="ltr">{ddmmyyyy(pr.at)}</bdi></> : null}
                    </span>
                  ) : null}
                  {current && snap.status === "buffering" && <span>{ar ? "جارٍ التحميل…" : "Buffering…"}</span>}
                  {current && snap.status === "unavailable" && <span className="err">{ar ? "تعذّر تشغيل هذا الملف من المصدر." : "This file couldn't be played."}</span>}
                  {!current && pr?.failAt && !pr.okAt && <span className="err">{ar ? "تعذّر تشغيلها سابقًا على هذا الجهاز" : "Failed on this device before"}</span>}
                </span>
                {(pct > 0 || current) && (
                  <span className="ep-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
              {resumeAt > 0 && !current && station && (
                <button className="btn btn-sm ep-restart" onClick={() => playEpisode(station, i, { fromStart: true })}>
                  {ar ? "من البداية" : "Restart"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {eps[0] && (
        <p className="hint source-note">
          {ar ? "المصدر: " : "Source: "}
          <a href={eps[0].sourceUrl} target="_blank" rel="noopener noreferrer">
            {eps[0].sourceName}
          </a>
          {ar ? " — ملفات منشورة للعامة على Internet Archive. حالة التشغيل تُسجَّل عند الاستماع الفعلي على هذا الجهاز." : " — public files on the Internet Archive."}
        </p>
      )}

      <nav className="surah-pager">
        {n > 1 && (
          <Link className="btn" href={`/tafsir/${n - 1}`}>
            {ar ? `→ سورة ${surahName(n - 1)}` : `← ${surahName(n - 1)}`}
          </Link>
        )}
        {n < 114 && (
          <Link className="btn" href={`/tafsir/${n + 1}`}>
            {ar ? `سورة ${surahName(n + 1)} ←` : `${surahName(n + 1)} →`}
          </Link>
        )}
      </nav>
    </div>
  );
}
