"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { TafsirContinue } from "@/components/TafsirContinue";
import { player, usePlayer } from "@/lib/player/controller";
import { CONTINUOUS_ID, continuousStation, loadManifest, playEpisode, SHARAWY_LIVE_ID, useManifest } from "@/lib/tafsir/client";
import { getProgress, toggleFavSurah, updateProgress, useProgress, surahStats, type TafsirProgress } from "@/lib/tafsir/progress";
import { surahName } from "@/lib/tafsir/parse";
import { SURAHS } from "@/lib/surahs";
import { normalize } from "@/lib/search/normalize";
import { catalogById } from "@/lib/catalog";
import { episodesCount } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

type Filter = "all" | "fav" | "recent" | "available" | "done";

export default function TafsirPage() {
  const lang = useLang();
  const ar = lang === "ar";
  const mounted = useMounted();
  const [mode, setMode] = useState<"surah" | "radio">("surah");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { manifest, status, stale } = useManifest();
  const progress = useProgress((p) => p);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("mode") === "radio") setMode("radio");
  }, []);

  const rows = useMemo(() => {
    const nq = normalize(q.trim());
    const num = /^\d{1,3}$/.test(q.trim()) ? Number(q.trim()) : null;
    const list = SURAHS.map((name, i) => {
      const n = i + 1;
      const eps = manifest?.surahs[n] ?? [];
      return { n, name, eps, stats: surahStats(progress, eps.map((e) => e.id)) };
    }).filter((r) => {
      if (num !== null) return r.n === num;
      if (nq && !normalize(r.name).includes(nq) && !normalize(`سورة ${r.name}`).includes(nq)) return false;
      if (filter === "fav") return progress.favSurahs.includes(r.n);
      if (filter === "recent") return progress.recentSurahs.includes(r.n);
      if (filter === "available") return r.eps.length > 0;
      if (filter === "done") return r.stats.total > 0 && r.stats.done === r.stats.total;
      return true;
    });
    if (filter === "recent") list.sort((a, b) => progress.recentSurahs.indexOf(a.n) - progress.recentSurahs.indexOf(b.n));
    return list;
  }, [manifest, progress, q, filter]);

  const available = manifest ? Object.keys(manifest.surahs).length : 0;

  return (
    <div className="page tafsir">
      <header className="tafsir-hero">
        <span className="tafsir-mark" aria-hidden>📖</span>
        <div>
          <h1 className="page-title">{ar ? "تفسير القرآن الكريم" : "Tafsir of the Holy Quran"}</h1>
          <p className="tafsir-sub">{ar ? "فضيلة الشيخ محمد متولي الشعراوي" : "Sheikh Muhammad Metwally Al-Sha'rawi"}</p>
        </div>
      </header>

      <div className="mode-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "surah"} className={mode === "surah" ? "on" : ""} onClick={() => setMode("surah")}>
          {ar ? "تفسير الشعراوي حسب السورة" : "By surah"}
        </button>
        <button role="tab" aria-selected={mode === "radio"} className={mode === "radio" ? "on" : ""} onClick={() => setMode("radio")}>
          {ar ? "إذاعة الشعراوي المستمرة" : "Continuous listening"}
        </button>
      </div>

      <TafsirContinue />

      {status === "loading" && !manifest && <p className="banner">{ar ? "جارٍ تحميل فهرس الحلقات من المصدر…" : "Loading the episode index…"}</p>}
      {status === "error" && !manifest && (
        <p className="banner banner-warn" role="alert">
          {ar ? "تعذّر تحميل فهرس الحلقات من Internet Archive الآن. تحقّق من الاتصال ثم أعد المحاولة." : "Couldn't load the episode index from the Internet Archive."}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => loadManifest(true)}>
            <Icon name="retry" size={14} /> {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </p>
      )}
      {stale && manifest && mounted && <p className="hint">{ar ? "يُعرض الفهرس المحفوظ على هذا الجهاز (تعذّر تحديثه الآن)." : "Showing the index saved on this device (couldn't refresh)."}</p>}

      {mode === "radio" ? (
        <RadioMode />
      ) : (
        <>
          <div className="surah-tools">
            <label className="search-box">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث باسم السورة أو رقمها…" : "Search by surah name or number…"} aria-label={ar ? "بحث في السور" : "Search surahs"} inputMode="search" />
            </label>
            <div className="chips" role="group" aria-label={ar ? "تصفية" : "Filter"}>
              {(
                [
                  ["all", ar ? "الكل" : "All"],
                  ["fav", ar ? "المفضلة" : "Favorites"],
                  ["recent", ar ? "الأخيرة" : "Recent"],
                  ["available", ar ? "المتوفرة" : "Available"],
                  ["done", ar ? "المكتملة" : "Completed"],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button key={f} className={`chip-btn ${filter === f ? "is-on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {label}
                </button>
              ))}
            </div>
            {manifest && (
              <p className="hint">
                {ar ? `متوفر تسجيل لـ ${available} سورة من 114 في المصادر.` : `Recordings available for ${available} of 114 surahs.`}
              </p>
            )}
          </div>

          {manifest && manifest.intro.length > 0 && filter === "all" && !q && (
            <Link href="/tafsir/0" className="surah-row intro-row">
              <span className="surah-num">★</span>
              <span className="surah-main">
                <strong>{ar ? "مقدمة التفسير" : "Introduction"}</strong>
                <span className="muted small">{episodesCount(manifest.intro.length, ar ? "ar" : "en")}</span>
              </span>
            </Link>
          )}

          <ul className="surah-list">
            {rows.map((r) => (
              <SurahRow key={r.n} n={r.n} name={r.name} count={r.eps.length} stats={r.stats} known={!!manifest} progress={progress} />
            ))}
            {rows.length === 0 && <li className="muted">{ar ? "لا توجد نتائج." : "No results."}</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function SurahRow({ n, name, count, stats, known, progress }: { n: number; name: string; count: number; stats: ReturnType<typeof surahStats>; known: boolean; progress: TafsirProgress }) {
  const ar = useLang() === "ar";
  const fav = progress.favSurahs.includes(n);
  const complete = stats.total > 0 && stats.done === stats.total;
  const isLast = progress.lastSurah === n;
  return (
    <li className={`surah-row ${count ? "" : "is-missing"} ${isLast ? "is-last" : ""}`}>
      <Link href={`/tafsir/${n}`} className="surah-link">
        <span className="surah-num" dir="ltr">{n}</span>
        <span className="surah-main">
          <strong>{ar ? `سورة ${name}` : `Surah ${n} · ${name}`}</strong>
          <span className="muted small">
            {!known ? "…" : count ? episodesCount(count, ar ? "ar" : "en") : ar ? "غير متوفر في المصادر" : "Not available"}
            {stats.started && ` · ${stats.percent}%`}
            {complete && (ar ? " · مكتملة ✓" : " · completed ✓")}
          </span>
          {stats.started && (
            <span className="surah-bar" aria-hidden>
              <span style={{ width: `${stats.percent}%` }} />
            </span>
          )}
        </span>
      </Link>
      <button className={`icon-btn ${fav ? "is-on" : ""}`} aria-pressed={fav} aria-label={fav ? (ar ? "إزالة من المفضلة" : "Unfavorite") : ar ? "إضافة للمفضلة" : "Favorite"} onClick={() => updateProgress((p) => toggleFavSurah(p, n))}>
        <Icon name="star" size={20} />
      </button>
    </li>
  );
}

function RadioMode() {
  const ar = useLang() === "ar";
  const { manifest } = useManifest();
  const snap = usePlayer();
  const live = catalogById.get(SHARAWY_LIVE_ID);
  const playingLive = snap.station?.id === SHARAWY_LIVE_ID && snap.status === "playing";
  const startContinuous = (fromLast: boolean) => {
    if (!manifest) return;
    const st = continuousStation(manifest);
    if (!st) return;
    const p = getProgress();
    let index = 0;
    if (fromLast && p.last) {
      const i = st.streams.findIndex((s) => s.id === p.last!.episodeId);
      if (i >= 0) index = i;
    }
    playEpisode(st, index, { fromStart: !fromLast });
  };
  return (
    <div className="radio-modes">
      <section className="mode-card is-live">
        <span className="mode-tag tag-live">
          <span className="live-dot" aria-hidden /> {ar ? "بث مباشر" : "LIVE"}
        </span>
        <h2>{ar ? "إذاعة الشيخ الشعراوي – بث مباشر" : "Al-Sha'rawi Radio — live stream"}</h2>
        <p className="hint">
          {ar
            ? "بث إذاعي حيّ على مدار الساعة (quran-uni.com). لا يمكن التقديم أو الرجوع أو الاستكمال من موضع محدد، فهو بث مباشر."
            : "A 24/7 live broadcast (quran-uni.com). No seeking or resume — it's live."}
        </p>
        {live ? (
          <button className="btn btn-gold" onClick={() => (playingLive ? player().stop() : player().playById(SHARAWY_LIVE_ID))}>
            <Icon name={playingLive ? "stop" : "play"} size={18} /> {playingLive ? (ar ? "إيقاف" : "Stop") : ar ? "استمع للبث المباشر" : "Listen live"}
          </button>
        ) : (
          <p className="banner banner-warn">{ar ? "محطة الشعراوي المباشرة غير ظاهرة (عمود «إظهار» في ملف Excel)." : "The live station is hidden in the Excel list."}</p>
        )}
      </section>

      <section className="mode-card is-recorded">
        <span className="mode-tag tag-rec">📼 {ar ? "تسجيلات متتالية" : "PRE-RECORDED"}</span>
        <h2>{ar ? "الاستماع المتصل – حلقات التفسير بالترتيب" : "Continuous — recorded episodes in order"}</h2>
        <p className="hint">
          {ar
            ? "قائمة تشغيل من الحلقات المسجّلة، من الفاتحة إلى آخر سورة متوفرة، تنتقل للحلقة التالية تلقائيًا ويُحفظ موضعك. ليست بثًا مباشرًا."
            : "A playlist of recorded episodes from Al-Fatiha onward; auto-advances and remembers your place. Not a live broadcast."}
        </p>
        <div className="row gap-s wrap">
          <button className="btn btn-gold" disabled={!manifest} onClick={() => startContinuous(true)}>
            <Icon name="play" size={18} /> {ar ? "متابعة من آخر حلقة" : "Continue"}
          </button>
          <button className="btn" disabled={!manifest} onClick={() => startContinuous(false)}>
            {ar ? "من البداية (الفاتحة)" : "From the start"}
          </button>
        </div>
        {snap.station?.id === CONTINUOUS_ID && snap.stream?.label && <p className="hint">{(ar ? "يُشغَّل الآن: " : "Now: ") + snap.stream.label}</p>}
      </section>
    </div>
  );
}
