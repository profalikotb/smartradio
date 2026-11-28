"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { resumePoint, useK } from "@/lib/khilafa";
import { clock, ddmmyyyy } from "@/lib/tafsir/format";
import { useLang, useMounted } from "@/lib/ui";

/** «استكمال المشاهدة» card for «الخلافة الإسلامية في 1000 عام». With onResume it plays in place; otherwise it opens the page and resumes. */
export function KhilafaContinue({ compact = false, onResume }: { compact?: boolean; onResume?: (index: number, pos: number) => void }) {
  const mounted = useMounted();
  const ar = useLang() === "ar";
  const s = useK();
  if (!mounted || !s.last) return null;
  const r = resumePoint(s);
  if (!r) return null;
  const id = s.ids[r.index] ?? s.last.id;
  const ep = s.eps[id];
  const t = s.titles[id];
  const label = ar ? "استكمال المشاهدة من آخر موضع" : "Continue from where I stopped";
  return (
    <section className={`continue-card is-khilafa ${compact ? "is-compact" : ""}`} aria-label={label}>
      <div className="cc-text">
        <span className="cc-kicker">📜 {ar ? "الخلافة الإسلامية في 1000 عام" : "The Caliphate in 1000 years"}</span>
        <strong className="cc-title">
          {ar ? `الحلقة ${r.index + 1}` : `Episode ${r.index + 1}`}
          {t ? ` – ${t}` : ""}
        </strong>
        <span className="cc-meta">
          {ar ? "آخر مشاهدة: الدقيقة " : "Stopped at "}
          <bdi dir="ltr">{clock(r.pos)}</bdi>
          {ep?.dur ? (
            <>
              {" / "}
              <bdi dir="ltr">{clock(ep.dur)}</bdi>
            </>
          ) : null}
          {" · "}
          <bdi dir="ltr">{ddmmyyyy(s.last.at)}</bdi>
        </span>
        {ep?.dur ? (
          <span className="cc-bar" aria-hidden>
            <span style={{ width: `${Math.min(100, (r.pos / ep.dur) * 100)}%` }} />
          </span>
        ) : null}
      </div>
      {onResume ? (
        <button className="btn btn-gold cc-btn" onClick={() => onResume(r.index, r.pos)}>
          <Icon name="play" size={18} /> {label}
        </button>
      ) : (
        <Link className="btn btn-gold cc-btn" href="/khilafa?resume=1">
          <Icon name="play" size={18} /> {label}
        </Link>
      )}
    </section>
  );
}
