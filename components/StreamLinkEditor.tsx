"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { catalogById } from "@/lib/catalog";
import { player } from "@/lib/player/controller";
import { useAppState, update } from "@/lib/store";
import { setStreamOverride } from "@/lib/state";
import { useLang } from "@/lib/ui";

const SIGNED = /dmcdn\.net\/sec2\(|[?&](token|expires|exp|sig|signature)=/i;

/**
 * Stream link of a station, replaceable on this device without a redeploy.
 * Signed links (Maspero/Dailymotion "sec2(...)") expire; paste a fresh one here when that happens.
 */
export function StreamLinkEditor({ id, failed }: { id: string; failed: boolean }) {
  const lang = useLang();
  const ar = lang === "ar";
  const override = useAppState((s) => s.streamOverrides[id]);
  const cat = catalogById.get(id);
  const excel = cat?.directStreams?.[0]?.url ?? cat?.playlist?.base;
  const isPlaylist = !override && !!cat?.playlist;
  const current = override ?? excel;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const signed = !!current && SIGNED.test(current);

  const save = () => {
    try {
      const u = new URL(url.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return setErr(ar ? "رابط غير صالح (يجب أن يبدأ بـ https://)." : "Invalid link (must start with https://).");
    }
    update((s) => setStreamOverride(s, id, url));
    setUrl("");
    setErr("");
    setOpen(false);
    player().playById(id);
  };

  return (
    <section className={`panel stream-link ${failed && signed ? "is-warn" : ""}`}>
      <h2 className="section-title">
        {ar ? "رابط البث" : "Stream link"}
        <button className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name={open ? "close" : "edit"} size={14} /> {open ? (ar ? "إلغاء" : "Cancel") : ar ? "تغيير الرابط" : "Change link"}
        </button>
      </h2>
      {current ? (
        <p className="link-line">
          <code dir="ltr" title={current}>{current}</code>
        </p>
      ) : (
        <p className="muted">{ar ? "لا يوجد رابط بث لهذه المحطة في ملف Excel." : "No stream link for this station in the Excel file."}</p>
      )}
      <p className="hint">
        {override
          ? ar ? "رابط مستبدل على هذا الجهاز (رابط ملف Excel يُستخدم كاحتياطي)." : "Replaced on this device (the Excel link is the fallback)."
          : ar ? "من ملف Excel." : "From the Excel file."}
        {isPlaylist && (ar ? " تُشغَّل السور سورةً بعد سورة (001–114) وتبدأ من سورة عشوائية." : " Plays surah after surah (001–114), starting at a random surah.")}
        {signed && (ar ? " هذا رابط موقّع من ماسبيرو/Dailymotion وينتهي بعد فترة؛ عند توقفه الصق رابطًا جديدًا." : " This is a signed Maspero/Dailymotion link and expires; paste a fresh one when it stops.")}
      </p>
      {failed && signed && !open && (
        <p className="banner banner-warn">
          {ar ? "غالبًا انتهت صلاحية الرابط." : "The link has probably expired."}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => setOpen(true)}>{ar ? "لصق رابط جديد" : "Paste a new link"}</button>
        </p>
      )}
      {open && (
        <form className="stack" onSubmit={(e) => (e.preventDefault(), save())}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" dir="ltr" inputMode="url" autoCapitalize="off" autoCorrect="off" autoFocus aria-label={ar ? "الرابط الجديد" : "New link"} />
          {err && <p className="hint warn">{err}</p>}
          <div className="row gap-s wrap">
            <button className="btn btn-gold" type="submit" disabled={!url.trim()}>
              <Icon name="play" size={16} /> {ar ? "حفظ وتشغيل" : "Save & play"}
            </button>
            {override && (
              <button type="button" className="btn" onClick={() => (update((s) => setStreamOverride(s, id, "")), setOpen(false))}>
                {ar ? "الرجوع لرابط Excel" : "Back to the Excel link"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
