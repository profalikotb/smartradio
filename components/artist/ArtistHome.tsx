"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { ArtistContinue } from "./ArtistContinue";
import { MyFiles } from "@/components/MyFiles";
import { player, usePlayer } from "@/lib/player/controller";
import { clientFor } from "@/lib/umm/client";
import type { ArtistSlug } from "@/lib/umm/artists";
import { surahStats, toggleFavId, type ListenProgress } from "@/lib/tafsir/progress";
import type { Song } from "@/lib/umm/parse";
import { normalize } from "@/lib/search/normalize";
import { catalogById } from "@/lib/catalog";
import { useLang, useMounted } from "@/lib/ui";
import { arCount, REC, SONGS } from "@/lib/tafsir/format";

type Filter = "all" | "fav" | "recent" | "heard";

function versionsCount(n: number, ar: boolean) {
  return ar ? arCount(n, REC) : `${n} version${n === 1 ? "" : "s"}`;
}

/** A singer's section: songs library, continuous/live radio and «ملفاتي». */
export function ArtistHome({ slug }: { slug: ArtistSlug }) {
  const c = clientFor(slug);
  const A = c.artist;
  const ar = useLang() === "ar";
  const mounted = useMounted();
  const [mode, setMode] = useState<"songs" | "radio" | "mine">("songs");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { library, status, stale } = c.useLibrary();
  const progress = c.store.use((p) => p);

  useEffect(() => {
    const m = new URLSearchParams(location.search).get("mode");
    if (m === "radio" || m === "mine") setMode(m);
  }, []);

  const rows = useMemo(() => {
    const songs = library?.songs ?? [];
    const nq = normalize(q.trim());
    const list = songs.filter((s) => {
      if (nq && !normalize(s.title).includes(nq)) return false;
      if (filter === "fav") return progress.favIds.includes(s.key);
      if (filter === "recent") return progress.recentIds.includes(s.key);
      if (filter === "heard") return s.versions.some((v) => progress.episodes[v.id]);
      return true;
    });
    if (filter === "recent") list.sort((a, b) => progress.recentIds.indexOf(a.key) - progress.recentIds.indexOf(b.key));
    return list;
  }, [library, progress, q, filter]);

  return (
    <div className={`page tafsir umm artist-${slug}`}>
      <header className="tafsir-hero">
        <span className="tafsir-mark umm-mark" aria-hidden>{A.mark}</span>
        <div>
          <h1 className="page-title">{ar ? A.titleAr : A.titleEn}</h1>
          <p className="tafsir-sub">{ar ? A.subtitleAr : A.subtitleEn}</p>
        </div>
      </header>

      <div className="mode-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "songs"} className={mode === "songs" ? "on" : ""} onClick={() => setMode("songs")}>
          {ar ? "الأغاني" : "Songs"}
        </button>
        <button role="tab" aria-selected={mode === "radio"} className={mode === "radio" ? "on" : ""} onClick={() => setMode("radio")}>
          {ar ? "الإذاعة المستمرة" : "Continuous"}
        </button>
        <button role="tab" aria-selected={mode === "mine"} className={mode === "mine" ? "on" : ""} onClick={() => setMode("mine")}>
          {ar ? "ملفاتي" : "My files"}
        </button>
      </div>

      <ArtistContinue slug={slug} />

      {status === "loading" && !library && <p className="banner">{ar ? "جارٍ تحميل مكتبة الأغاني من المصدر…" : "Loading the song library…"}</p>}
      {status === "error" && !library && (
        <p className="banner banner-warn" role="alert">
          {ar ? "تعذّر تحميل مكتبة الأغاني من Internet Archive الآن." : "Couldn't load the library from the Internet Archive."}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => c.loadLibrary(true)}>
            <Icon name="retry" size={14} /> {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </p>
      )}
      {stale && library && mounted && <p className="hint">{ar ? "تُعرض المكتبة المحفوظة على هذا الجهاز (تعذّر تحديثها الآن)." : "Showing the library saved on this device."}</p>}

      {mode === "mine" ? (
        <MyFiles slug={slug} />
      ) : mode === "radio" ? (
        <RadioMode slug={slug} />
      ) : (
        <>
          <div className="surah-tools">
            <label className="search-box">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث باسم الأغنية…" : "Search songs…"} aria-label={ar ? "بحث في الأغاني" : "Search songs"} inputMode="search" />
            </label>
            <div className="chips" role="group">
              {(
                [
                  ["all", ar ? "الكل" : "All"],
                  ["fav", ar ? "المفضلة" : "Favorites"],
                  ["recent", ar ? "الأخيرة" : "Recent"],
                  ["heard", ar ? "استمعت إليها" : "Listened"],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button key={f} className={`chip-btn ${filter === f ? "is-on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {label}
                </button>
              ))}
            </div>
            {library && <p className="hint">{ar ? `${arCount(library.songs.length, SONGS)} · ${arCount(library.songs.reduce((a, s) => a + s.versions.length, 0), REC)} من ${library.sources.filter((s) => s.ok).length} مصادر.` : `${library.songs.length} songs.`}</p>}
          </div>
          <ul className="surah-list">
            {rows.map((s) => (
              <SongRow key={s.key} slug={slug} song={s} progress={progress} />
            ))}
            {library && rows.length === 0 && <li className="muted">{ar ? "لا توجد نتائج." : "No results."}</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function SongRow({ slug, song, progress }: { slug: ArtistSlug; song: Song; progress: ListenProgress }) {
  const c = clientFor(slug);
  const ar = useLang() === "ar";
  const fav = progress.favIds.includes(song.key);
  const stats = surahStats(progress, song.versions.map((v) => v.id));
  const isLast = progress.last?.key === song.key;
  const mins = Math.round(song.versions.reduce((a, v) => Math.max(a, v.duration), 0) / 60);
  return (
    <li className={`surah-row ${isLast ? "is-last" : ""}`}>
      <Link href={`${c.artist.route}/${song.key}`} className="surah-link">
        <span className="surah-num umm-num" aria-hidden>♪</span>
        <span className="surah-main">
          <strong dir={song.arabic ? "rtl" : "ltr"}>{song.title}</strong>
          <span className="muted small">
            {versionsCount(song.versions.length, ar)}
            {mins ? (ar ? ` · حتى ${mins} دقيقة` : ` · up to ${mins} min`) : ""}
            {stats.done > 0 && (ar ? " · ✓ استمعت" : " · ✓ heard")}
          </span>
          {stats.started && (
            <span className="surah-bar" aria-hidden>
              <span style={{ width: `${stats.percent}%` }} />
            </span>
          )}
        </span>
      </Link>
      <button className={`icon-btn ${fav ? "is-on" : ""}`} aria-pressed={fav} aria-label={fav ? (ar ? "إزالة من المفضلة" : "Unfavorite") : ar ? "إضافة للمفضلة" : "Favorite"} onClick={() => c.store.update((p) => toggleFavId(p, song.key))}>
        <Icon name="star" size={20} />
      </button>
    </li>
  );
}

function RadioMode({ slug }: { slug: ArtistSlug }) {
  const c = clientFor(slug);
  const A = c.artist;
  const ar = useLang() === "ar";
  const { library } = c.useLibrary();
  const snap = usePlayer();
  const live = catalogById.get(A.liveId);
  const playingLive = snap.station?.id === A.liveId && (snap.status === "playing" || snap.status === "buffering");
  const startContinuous = (fromLast: boolean) => {
    if (!library) return;
    const st = c.continuousStation(library);
    if (!st) return;
    const p = c.store.get();
    let index = 0;
    if (fromLast && p.last) {
      const i = st.streams.findIndex((s) => s.id === p.last!.episodeId);
      if (i >= 0) index = i;
    }
    c.playVersion(st, index, { fromStart: !fromLast });
  };
  return (
    <div className="radio-modes">
      <section className="mode-card is-live">
        <span className="mode-tag tag-live">
          <span className="live-dot" aria-hidden /> {ar ? "بث مباشر" : "LIVE"}
        </span>
        <h2>{ar ? A.liveTitleAr : `${A.nameEn} Radio — live`}</h2>
        <p className="hint">{ar ? A.liveDescAr : `A 24/7 ${A.nameEn} radio picked automatically from the radio directory. Live: no seeking or resume.`}</p>
        {live ? (
          <button className="btn btn-gold" onClick={() => (playingLive ? player().stop() : player().playById(A.liveId))}>
            <Icon name={playingLive ? "stop" : "play"} size={18} /> {playingLive ? (ar ? "إيقاف" : "Stop") : ar ? "استمع للبث المباشر" : "Listen live"}
          </button>
        ) : (
          <p className="banner banner-warn">{ar ? `صف «${A.liveTitleAr.split(" – ")[0]}» مخفي في ملف Excel (عمود «إظهار»).` : "The live row is hidden in the Excel list."}</p>
        )}
      </section>

      <section className="mode-card is-recorded">
        <span className="mode-tag tag-rec">📼 {ar ? "تسجيلات متتالية" : "PRE-RECORDED"}</span>
        <h2>{ar ? "الاستماع المتصل – أغنية بعد أغنية" : "Continuous — song after song"}</h2>
        <p className="hint">
          {ar
            ? "كل أغاني المكتبة بترتيب عشوائي، أغنية بعد أغنية بلا توقف، ويُحفظ موضعك في كل أغنية. ليست بثًا مباشرًا."
            : "The whole library shuffled, song after song; your place is saved. Not a live broadcast."}
        </p>
        <div className="row gap-s wrap">
          <button className="btn btn-gold" disabled={!library} onClick={() => startContinuous(true)}>
            <Icon name="play" size={18} /> {ar ? "ابدأ الاستماع" : "Start"}
          </button>
          <button className="btn" disabled={!library} onClick={() => startContinuous(false)}>
            {ar ? "أغنية جديدة" : "New song"}
          </button>
        </div>
        {snap.station?.id === c.allId && snap.stream?.label && <p className="hint">{(ar ? "يُشغَّل الآن: " : "Now: ") + snap.stream.label}</p>}
      </section>
    </div>
  );
}
