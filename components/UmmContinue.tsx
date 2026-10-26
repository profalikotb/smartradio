"use client";
import { Icon } from "./Icon";
import { continueUmm, ummStore, useLibrary, UMM_ALL_ID } from "@/lib/umm/client";
import { clock, ddmmyyyy } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

/** «▶ استكمال الاستماع من آخر موضع» for Umm Kulthum. */
export function UmmContinue({ compact = false }: { compact?: boolean }) {
  const mounted = useMounted();
  const ar = useLang() === "ar";
  const last = ummStore.use((p) => p.last);
  const saved = ummStore.use((p) => (p.last ? p.episodes[p.last.episodeId] : undefined));
  const { library, status } = useLibrary();
  if (!mounted || !last) return null;
  const song = library?.songs.find((s) => s.key === last.key);
  const version = song?.versions.find((v) => v.id === last.episodeId);
  const pos = saved && !saved.done ? saved.pos : last.pos;
  return (
    <section className={`continue-card is-umm ${compact ? "is-compact" : ""}`} aria-label={ar ? "استكمال الاستماع" : "Continue listening"}>
      <div className="cc-text">
        <span className="cc-kicker">
          <Icon name="music" size={16} /> {ar ? "أم كلثوم" : "Umm Kulthum"}
          {last.stationId === UMM_ALL_ID ? (ar ? " · الاستماع المتصل" : " · continuous") : ""}
        </span>
        <strong className="cc-title">
          {song?.title ?? (ar ? "آخر أغنية" : "Last song")}
          {!compact && version ? ` — ${version.label}` : ""}
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
      <button className="btn btn-gold cc-btn" disabled={!library} onClick={() => library && continueUmm(library)}>
        <Icon name="play" size={18} /> {ar ? "استكمال الاستماع من آخر موضع" : "Continue from where I stopped"}
      </button>
      {!library && status === "loading" && <span className="hint">{ar ? "جارٍ تحميل المكتبة…" : "Loading library…"}</span>}
    </section>
  );
}
