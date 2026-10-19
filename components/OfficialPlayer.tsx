"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { player } from "@/lib/player/controller";
import { catalogById } from "@/lib/catalog";
import { useT } from "@/lib/ui";

/** Button + sheet that shows the broadcaster's own embedded player. Stops our audio first (no overlap). */
export function OfficialPlayerButton({ id, small }: { id: string; small?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const op = catalogById.get(id)?.officialPlayer;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  if (!op) return null;
  return (
    <>
      <button
        className={`btn ${small ? "btn-sm" : ""}`}
        onClick={() => {
          player().stop();
          setOpen(true);
        }}
      >
        <Icon name="play" size={14} /> {t.officialPlayer}
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t.officialPlayer} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden />
            <button className="icon-btn sheet-close" onClick={() => setOpen(false)} aria-label={t.close}>
              <Icon name="close" />
            </button>
            <h2 className="sheet-title" style={{ textAlign: "center" }}>{t.officialPlayer}</h2>
            <div className="embed-frame">
              <iframe
                src={op.embedUrl}
                title={t.officialPlayer}
                allow="autoplay; fullscreen; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <p className="hint">{t.officialPlayerNote}</p>
            <p className="hint">
              {op.provider} ·{" "}
              <a href={op.pageUrl} target="_blank" rel="noopener noreferrer">
                {t.openOnSite}
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
