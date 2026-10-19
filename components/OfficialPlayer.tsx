"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "./Icon";
import { player } from "@/lib/player/controller";
import { catalogById } from "@/lib/catalog";
import { displayName } from "@/lib/stations";
import { useAppState } from "@/lib/store";
import { useLang, useT } from "@/lib/ui";

/*
 * In-app live player for stations the broadcaster publishes only as an embedded live player
 * (Egyptian state radio via Dailymotion). One shared window for the whole app; opening it stops
 * the app's own audio so two streams never overlap.
 */
let openId: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function hasEmbed(id: string): boolean {
  return !!catalogById.get(id)?.officialPlayer?.embedUrl;
}

export function openEmbed(id: string) {
  if (!hasEmbed(id)) return;
  player().stop();
  openId = id;
  emit();
}

export function closeEmbed() {
  openId = null;
  emit();
}

function useOpenId() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => openId,
    () => null,
  );
}

/** Mounted once (in Shell). */
export function EmbedHost() {
  const id = useOpenId();
  const t = useT();
  const lang = useLang();
  const nick = useAppState((s) => s.nicknames);
  useEffect(() => {
    if (!id) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && closeEmbed();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [id]);
  const c = id ? catalogById.get(id) : undefined;
  if (!id || !c?.officialPlayer?.embedUrl) return null;
  return (
    <div className="sheet-backdrop" onClick={closeEmbed}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={displayName(c, lang, nick)} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <button className="icon-btn sheet-close" onClick={closeEmbed} aria-label={t.close}>
          <Icon name="close" />
        </button>
        <h2 className="sheet-title" style={{ textAlign: "center" }}>
          {displayName(c, lang, nick)}
        </h2>
        {c.frequency && <p className="muted" dir="ltr" style={{ textAlign: "center", margin: 0 }}>{c.frequency}</p>}
        <div className="embed-frame">
          <iframe
            key={id}
            src={`${c.officialPlayer.embedUrl}${c.officialPlayer.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            title={displayName(c, lang, nick)}
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="hint">{t.embedNote}</p>
      </div>
    </div>
  );
}

/** Small button for detail pages / cards. */
export function OfficialPlayerButton({ id, small }: { id: string; small?: boolean }) {
  const t = useT();
  if (!hasEmbed(id)) return null;
  return (
    <button className={`btn ${small ? "btn-sm" : ""}`} onClick={() => openEmbed(id)}>
      <Icon name="play" size={14} /> {t.play}
    </button>
  );
}
