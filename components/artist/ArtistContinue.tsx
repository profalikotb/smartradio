"use client";
import { Icon } from "@/components/Icon";
import { clientFor } from "@/lib/umm/client";
import type { ArtistSlug } from "@/lib/umm/artists";
import { clock, ddmmyyyy } from "@/lib/tafsir/format";
import { useMyFiles } from "@/lib/umm/local";
import { useLang, useMounted } from "@/lib/ui";

/** «▶ استكمال الاستماع من آخر موضع» for one singer's section. */
export function ArtistContinue({ slug, compact = false }: { slug: ArtistSlug; compact?: boolean }) {
  const c = clientFor(slug);
  const A = c.artist;
  const mounted = useMounted();
  const ar = useLang() === "ar";
  const last = c.store.use((p) => p.last);
  const saved = c.store.use((p) => (p.last ? p.episodes[p.last.episodeId] : undefined));
  const { library, status } = c.useLibrary();
  const { files } = useMyFiles();
  const localTitle = files.find((f) => last && `local/${f.id}` === last.episodeId)?.title;
  if (!mounted || !last) return null;
  const local = last.stationId === c.myId;
  const song = library?.songs.find((s) => s.key === last.key);
  const version = song?.versions.find((v) => v.id === last.episodeId);
  const pos = saved && !saved.done ? saved.pos : last.pos;
  return (
    <section className={`continue-card is-umm artist-${slug} ${compact ? "is-compact" : ""}`} aria-label={ar ? "استكمال الاستماع" : "Continue listening"}>
      <div className="cc-text">
        <span className="cc-kicker">
          <Icon name="music" size={16} /> {ar ? A.nameAr : A.nameEn}
          {last.stationId === c.allId ? (ar ? " · الاستماع المتصل" : " · continuous") : local ? (ar ? " · ملفاتي" : " · my files") : ""}
        </span>
        <strong className="cc-title">
          {song?.title ?? (local ? localTitle : null) ?? (ar ? "آخر أغنية" : "Last song")}
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
      <button className="btn btn-gold cc-btn" disabled={!library && !local} onClick={() => c.continueLast(library)}>
        <Icon name="play" size={18} /> {ar ? "استكمال الاستماع من آخر موضع" : "Continue from where I stopped"}
      </button>
      {!library && status === "loading" && <span className="hint">{ar ? "جارٍ تحميل المكتبة…" : "Loading library…"}</span>}
    </section>
  );
}
