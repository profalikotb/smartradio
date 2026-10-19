"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LiveBadge, PlayButton, SleepTimer, statusLabel, useUiStatus } from "@/components/Player";
import { QURAN_CAIRO_ID } from "@/lib/catalog";
import { player } from "@/lib/player/controller";
import { viewOf } from "@/lib/stations";
import { useLang, useT } from "@/lib/ui";

export default function FocusPage() {
  const t = useT();
  const lang = useLang();
  const ui = useUiStatus();
  const v = viewOf(QURAN_CAIRO_ID)!;
  const isQuran = ui.stationId === QURAN_CAIRO_ID;

  return (
    <div className="focus">
      <Link href="/" className="focus-exit btn btn-sm">
        <Icon name="close" size={16} /> {t.exitFocus}
      </Link>
      <div className="focus-center">
        <div className="focus-ornament" aria-hidden />
        <h1 className="focus-title">{lang === "ar" ? v.nameAr : v.nameEn}</h1>
        <p className="focus-sub">{t.focusHint}</p>
        <div className="focus-play">
          {isQuran ? (
            <PlayButton size="xl" />
          ) : (
            <button className="play-btn play-xl" onClick={() => player().playById(QURAN_CAIRO_ID)} aria-label={t.play}>
              <span className="play-ring" aria-hidden />
              <Icon name="play" size={44} />
            </button>
          )}
        </div>
        <p className={`focus-status st-${isQuran ? ui.status : "idle"}`} role="status" aria-live="polite">
          {isQuran ? (
            <>
              <LiveBadge status={ui.status} /> {ui.status === "playing" ? t.liveBroadcast : statusLabel(ui.status, t)}
            </>
          ) : (
            t.tapToStart
          )}
        </p>
        {isQuran && ui.message && (
          <div className="focus-msg">
            <p>{ui.message}</p>
            <button className="btn btn-gold" onClick={() => player().retry()}>
              <Icon name="retry" size={18} /> {t.retry}
            </button>
          </div>
        )}
      </div>
      <div className="focus-timer">
        <SleepTimer />
      </div>
    </div>
  );
}
