"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { player, usePlayer } from "@/lib/player/controller";
import { playVersion, ummStore } from "@/lib/umm/client";
import { addFiles, fmtSize, MY_FILES_ID, myFilesStation, removeFile, renameFile, storageUse, useMyFiles } from "@/lib/umm/local";
import { resumePosition } from "@/lib/tafsir/progress";
import { clock, ddmmyyyy } from "@/lib/tafsir/format";
import { normalize } from "@/lib/search/normalize";
import { useLang, useMounted } from "@/lib/ui";
import { whyNotPlayable } from "@/lib/umm/sniff";

/** «ملفاتي»: Umm Kulthum recordings added from this device, stored and played locally (free, private). */
export function MyFiles() {
  const ar = useLang() === "ar";
  const mounted = useMounted();
  const { status, files, busy, error } = useMyFiles();
  const progress = ummStore.use((p) => p);
  const snap = usePlayer();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [use, setUse] = useState<{ used: number; quota: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    void storageUse().then(setUse);
  }, [files.length]);

  const here = snap.station?.id === MY_FILES_ID;
  const nq = normalize(q.trim());
  const shown = files.filter((f) => !nq || normalize(f.title).includes(nq) || normalize(f.name).includes(nq));

  const play = async (fileId: string, fromStart = false) => {
    player().engine.unlock(); // inside the tap (iPhone), before the async read
    const st = await myFilesStation();
    if (!st) return;
    const i = st.streams.findIndex((s) => s.id === `local/${fileId}`);
    playVersion(st, Math.max(0, i), { fromStart: fromStart || i < 0 });
  };

  return (
    <section className="my-files">
      <div className="panel my-files-head">
        <p className="hint">
          {ar
            ? "أضف تسجيلات أم كلثوم الموجودة عندك (MP3 أو M4A أو FLAC…). تُحفظ على هذا الجهاز فقط — لا تُرفع إلى أي خادم ولا يراها غيرك — وتعمل دون إنترنت، مع الاستكمال من آخر دقيقة."
            : "Add Umm Kulthum recordings you have (MP3, M4A, FLAC…). Stored on this device only — never uploaded — and they play offline, resuming where you stopped."}
        </p>
        <div className="row gap-s wrap">
          <button className="btn btn-gold" onClick={() => input.current?.click()} disabled={!!busy}>
            <Icon name="plus" size={18} /> {busy ? (ar ? `جارٍ الإضافة ${busy}…` : `Adding ${busy}…`) : ar ? "إضافة من جهازي" : "Add from my device"}
          </button>
          {files.length > 0 && (
            <button className="btn" onClick={() => void play(files[0]!.id)}>
              <Icon name="play" size={18} /> {ar ? "تشغيل الكل" : "Play all"}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.ogg,.opus"
          multiple
          hidden
          onChange={async (e) => {
            const list = e.target.files;
            if (!list?.length) return;
            const r = await addFiles(list);
            e.target.value = "";
            setMsg(
              ar
                ? `أُضيف ${r.added}${r.skipped ? ` · تم تجاهل ${r.skipped} (ليست ملفات صوتية)` : ""}`
                : `Added ${r.added}${r.skipped ? ` · skipped ${r.skipped} (not audio)` : ""}`,
            );
          }}
        />
        {msg && <p className="banner banner-ok" role="status">{msg}</p>}
        {error === "quota" && <p className="banner banner-warn" role="alert">{ar ? "امتلأت مساحة التخزين المتاحة للتطبيق على هذا الجهاز. احذف بعض الملفات ثم أعد المحاولة." : "Storage is full on this device."}</p>}
        {(status === "error" || error === "storage") && <p className="banner banner-warn" role="alert">{ar ? "هذا المتصفح لا يسمح بحفظ الملفات (وضع التصفح الخاص؟)." : "This browser can't store files (private mode?)."}</p>}
        {mounted && use && (
          <p className="hint">
            {ar ? "المساحة المستخدمة على هذا الجهاز: " : "Storage used on this device: "}
            <bdi dir="ltr">{fmtSize(use.used)} / {fmtSize(use.quota)}</bdi>
          </p>
        )}
      </div>

      {files.length > 6 && (
        <label className="search-box">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث في ملفاتي…" : "Search my files…"} aria-label={ar ? "بحث في ملفاتي" : "Search my files"} />
        </label>
      )}

      {status === "ready" && files.length === 0 && (
        <p className="muted empty-files">{ar ? "لا توجد ملفات بعد. اضغط «إضافة من جهازي» واختر ملفات صوتية من الملفات أو iCloud Drive أو الكمبيوتر." : "No files yet."}</p>
      )}

      <ol className="episode-list">
        {shown.map((f) => {
          const eid = `local/${f.id}`;
          const pr = progress.episodes[eid];
          const current = here && snap.stream?.id === eid;
          const playing = current && (snap.status === "playing" || snap.status === "buffering" || snap.status === "connecting");
          const pos = current ? snap.position : pr?.pos ?? 0;
          const dur = (current ? snap.duration : 0) || pr?.dur || f.duration;
          const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
          const resumeAt = mounted ? resumePosition(ummStore.get(), eid) : 0;
          return (
            <li key={f.id} className={`episode ${current ? "is-current" : ""} ${pr?.done ? "is-done" : ""}`}>
              <button className="ep-play" disabled={f.playable === false} onClick={() => (current ? player().toggle() : void play(f.id))} aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause") : `${ar ? "تشغيل" : "Play"} ${f.title}`}>
                <Icon name={playing ? "pause" : "play"} size={22} />
              </button>
              <div className="ep-main">
                {editing === f.id ? (
                  <form
                    className="row gap-s"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renameFile(f.id, String(new FormData(e.currentTarget).get("t") ?? ""));
                      setEditing(null);
                    }}
                  >
                    <input name="t" defaultValue={f.title} autoFocus maxLength={120} aria-label={ar ? "اسم التسجيل" : "Title"} />
                    <button className="btn btn-sm btn-gold" type="submit">✓</button>
                  </form>
                ) : (
                  <strong className="ep-title">{f.title}</strong>
                )}
                <span className="ep-meta">
                  {dur ? <bdi dir="ltr">{clock(dur)}</bdi> : null}
                  {dur ? " · " : ""}
                  <bdi dir="ltr">{fmtSize(f.size)}</bdi>
                  {" · "}
                  <bdi dir="ltr">{f.format ?? (f.name.split(".").pop() ?? "").toUpperCase()}</bdi>
                  {f.format && f.playable !== false && !f.name.toLowerCase().endsWith(`.${f.format.toLowerCase()}`) && f.format !== "AAC" && (
                    <span className="muted">{ar ? ` (اسم الملف .${f.name.split(".").pop()})` : ` (named .${f.name.split(".").pop()})`}</span>
                  )}
                </span>
                <span className="ep-state">
                  {f.playable === false && <span className="err">{whyNotPlayable({ format: f.format ?? "Unknown", mime: "", playable: false })}</span>}
                  {pr?.done ? (
                    <span className="ok">{ar ? "✓ استمعت إليه كاملًا" : "✓ Heard in full"}</span>
                  ) : resumeAt > 0 && !current ? (
                    <span>
                      {ar ? "توقفت عند " : "Stopped at "}
                      <bdi dir="ltr">{clock(resumeAt)}</bdi>
                      {pr?.at ? <> · <bdi dir="ltr">{ddmmyyyy(pr.at)}</bdi></> : null}
                    </span>
                  ) : null}
                  {current && snap.status === "unavailable" && f.playable !== false && (
                    <span className="err">
                      {ar
                        ? `تعذّر تشغيل هذا الملف (${f.format ?? "?"}) — قد يكون تالفًا أو غير مكتمل التحميل. جرّبه في برنامج VLC.`
                        : "This file couldn't be played; it may be damaged or incomplete."}
                    </span>
                  )}
                </span>
                {(pct > 0 || current) && (
                  <span className="ep-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
              <span className="file-actions">
                <button className="icon-btn" onClick={() => setEditing(editing === f.id ? null : f.id)} aria-label={ar ? "تعديل الاسم" : "Rename"} title={ar ? "تعديل الاسم" : "Rename"}>
                  <Icon name="edit" size={18} />
                </button>
                <button
                  className="icon-btn icon-danger"
                  aria-label={ar ? "حذف من الجهاز" : "Delete from device"}
                  title={ar ? "حذف من الجهاز" : "Delete from device"}
                  onClick={() => {
                    if (!confirm(ar ? `حذف «${f.title}» من هذا الجهاز؟` : `Delete “${f.title}” from this device?`)) return;
                    if (current) player().stop();
                    void removeFile(f.id);
                  }}
                >
                  <Icon name="trash" size={18} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      {files.length > 0 && (
        <p className="hint">
          {ar
            ? "الملفات محفوظة في هذا المتصفح على هذا الجهاز. لا تُنقل مع «تصدير المفضلة»، وتُحذف إذا مسحت بيانات الموقع أو حذفت التطبيق من الشاشة الرئيسية. احتفظ بنسخها الأصلية."
            : "Files live in this browser on this device; keep your originals."}
        </p>
      )}
    </section>
  );
}
