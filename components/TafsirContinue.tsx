"use client";
import { Icon } from "./Icon";
import { continueLast, useManifest } from "@/lib/tafsir/client";
import { useProgress } from "@/lib/tafsir/progress";
import { surahName } from "@/lib/tafsir/parse";
import { clock, ddmmyyyy, episodeOrdinal } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

/** «▶ استكمال الاستماع من آخر موضع» — continues Tafsir exactly where it stopped. */
export function TafsirContinue({ compact = false }: { compact?: boolean }) {
  const mounted = useMounted();
  const lang = useLang();
  const ar = lang === "ar";
  const last = useProgress((p) => p.last);
  const saved = useProgress((p) => (p.last ? p.episodes[p.last.episodeId] : undefined));
  const { manifest, status } = useManifest();
  if (!mounted || !last) return null;
  const ep = last.surah > 0 ? manifest?.surahs[last.surah]?.find((e) => e.id === last.episodeId) : manifest?.intro.find((e) => e.id === last.episodeId);
  const pos = saved && !saved.done ? saved.pos : last.pos;
  const what = last.surah > 0 ? `سورة ${surahName(last.surah)} – ${episodeOrdinal(ep?.part ?? last.index + 1, lang)}` : surahName(0);
  const verses = ep?.verseStart ? (ar ? ` (الآيات ${ep.verseStart}–${ep.verseEnd ?? ep.verseStart})` : ` (verses ${ep.verseStart}–${ep.verseEnd ?? ep.verseStart})`) : "";
  const disabled = !manifest;
  return (
    <section className={`continue-card ${compact ? "is-compact" : ""}`} aria-label={ar ? "استكمال الاستماع" : "Continue listening"}>
      <div className="cc-text">
        <span className="cc-kicker">
          <Icon name="quran" size={16} /> {ar ? "تفسير الشعراوي" : "Al-Sha'rawi Tafsir"}
          {last.stationId === "tafsir:all" ? (ar ? " · الاستماع المتصل" : " · continuous") : ""}
        </span>
        <strong className="cc-title">
          {what}
          {!compact && verses}
        </strong>
        <span className="cc-meta">
          {ar ? "آخر استماع: الدقيقة " : "Stopped at "}
          <bdi dir="ltr">{clock(pos)}</bdi>
          {saved?.dur ? (
            <>
              {" / "}
              <bdi dir="ltr">{clock(saved.dur)}</bdi>
            </>
          ) : null}
          {" · "}
          <bdi dir="ltr">{ddmmyyyy(last.at)}</bdi>
        </span>
        {saved?.dur ? (
          <span className="cc-bar" aria-hidden>
            <span style={{ width: `${Math.min(100, (pos / saved.dur) * 100)}%` }} />
          </span>
        ) : null}
      </div>
      <button className="btn btn-gold cc-btn" disabled={disabled} onClick={() => manifest && continueLast(manifest)}>
        <Icon name="play" size={18} /> {ar ? "استكمال الاستماع من آخر موضع" : "Continue from where I stopped"}
      </button>
      {disabled && status === "loading" && <span className="hint">{ar ? "جارٍ تحميل الفهرس…" : "Loading index…"}</span>}
    </section>
  );
}
