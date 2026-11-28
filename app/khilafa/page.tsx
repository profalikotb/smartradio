"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { KhilafaContinue } from "@/components/KhilafaContinue";
import { apiFetch } from "@/lib/api";
import { getK, isYtId, KHILAFA, recordK, resumePoint, updateK, useK } from "@/lib/khilafa";
import { player } from "@/lib/player/controller";
import { normalize } from "@/lib/search/normalize";
import { clock } from "@/lib/tafsir/format";
import { useLang } from "@/lib/ui";

/* Minimal typing of YouTube's official IFrame Player API. */
interface YTPlayer {
  cuePlaylist(o: { listType: "playlist"; list: string; index?: number; startSeconds?: number }): void;
  loadPlaylist(o: { listType: "playlist"; list: string; index?: number; startSeconds?: number }): void;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoData(): { video_id?: string; title?: string };
  destroy(): void;
}
type YTNs = { Player: new (el: HTMLElement, o: object) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNs;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNs> | null = null;
function loadApi(): Promise<YTNs> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("yt"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const PLAYING = 1;
const PAUSED = 2;
const ENDED = 0;

export default function KhilafaPage() {
  const ar = useLang() === "ar";
  const s = useK();
  const host = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const save = useCallback(() => {
    const p = yt.current;
    if (!p) return;
    const d = p.getVideoData?.() ?? {};
    const id = d.video_id ?? "";
    if (!isYtId(id)) return;
    setCurrent(id);
    recordK(id, p.getPlaylistIndex(), p.getCurrentTime(), p.getDuration(), d.title || undefined);
  }, []);

  const syncIds = useCallback(() => {
    const ids = yt.current?.getPlaylist?.();
    if (ids?.length && ids.join() !== getK().ids.join()) updateK((st) => ({ ...st, ids }));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    loadApi()
      .then((YT) => {
        if (!alive || !host.current) return;
        const r = resumePoint(getK());
        const auto = new URLSearchParams(location.search).get("resume") === "1";
        // YouTube replaces its target node with an iframe, so give it a child React does not own.
        const target = document.createElement("div");
        host.current.replaceChildren(target);
        yt.current = new YT.Player(target, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              const o = { listType: "playlist" as const, list: KHILAFA.playlistId, index: r?.index ?? 0, startSeconds: r?.pos ?? 0 };
              if (auto && r) yt.current?.loadPlaylist(o);
              else yt.current?.cuePlaylist(o);
              setReady(true);
            },
            onStateChange: (e: { data: number }) => {
              syncIds();
              if (e.data === PLAYING) {
                player().stop(); // never two audios at once
                save();
              } else if (e.data === PAUSED || e.data === ENDED) save();
            },
            onError: () => setFailed(true),
          },
        });
        timer = setInterval(() => {
          if (yt.current?.getPlayerState?.() === PLAYING) save();
        }, 4000);
      })
      .catch(() => setFailed(true));
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      try {
        save();
        yt.current?.destroy();
        host.current?.replaceChildren();
      } catch {
        /* gone */
      }
      yt.current = null;
    };
  }, [save, syncIds]);

  // Episode titles: YouTube's oEmbed via our API (cached on the device).
  useEffect(() => {
    const missing = s.ids.filter((id) => !s.titles[id]);
    if (!missing.length) return;
    apiFetch(`/api/yt-titles?ids=${missing.slice(0, 60).join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { titles?: Record<string, string> } | null) => {
        if (j?.titles && Object.keys(j.titles).length) updateK((st) => ({ ...st, titles: { ...st.titles, ...j.titles } }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ids.join()]);

  const playAt = (index: number, pos = 0) => {
    const p = yt.current;
    if (!p) return;
    p.loadPlaylist({ listType: "playlist", list: KHILAFA.playlistId, index, startSeconds: pos });
    host.current?.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rows = useMemo(() => {
    const nq = normalize(q.trim());
    const list = s.ids.map((id, i) => ({ id, i, title: s.titles[id] ?? "" })).filter((r) => !nq || normalize(r.title).includes(nq) || String(r.i + 1) === q.trim());
    return s.newestFirst ? list.reverse() : list;
  }, [s.ids, s.titles, s.newestFirst, q]);

  return (
    <div className="page tafsir khilafa">
      <header className="tafsir-hero">
        <span className="tafsir-mark khilafa-mark" aria-hidden>📜</span>
        <div>
          <h1 className="page-title">{ar ? "الخلافة الإسلامية في 1000 عام" : "The Islamic Caliphate in 1000 years"}</h1>
          <p className="tafsir-sub">{ar ? "د. إبراهيم العسال مع الصحفي سيد جبيل · قناة «نعرف»" : "Dr Ibrahim El-Assal with Sayed Gobeil · Ne3raf"}</p>
        </div>
      </header>

      <KhilafaContinue onResume={playAt} />

      <div className="video-frame">
        <div ref={host} />
        {!ready && !failed && <span className="video-wait">{ar ? "جارٍ تحميل مشغّل يوتيوب…" : "Loading YouTube player…"}</span>}
      </div>
      {failed && (
        <p className="banner banner-warn" role="alert">
          {ar ? "تعذّر تشغيل مشغّل يوتيوب هنا. " : "YouTube player failed. "}
          <a href={KHILAFA.playlistUrl} target="_blank" rel="noreferrer">
            {ar ? "افتح قائمة الحلقات على يوتيوب" : "Open the playlist on YouTube"}
          </a>
        </p>
      )}
      <p className="hint">
        {ar
          ? "يعمل عبر مشغّل يوتيوب الرسمي (قائمة الحلقات الرسمية لقناة «نعرف»): يُحفظ موضعك في كل حلقة تلقائيًا. يتوقف الصوت عند قفل شاشة iPhone أو مغادرة الصفحة، وقد تظهر إعلانات يوتيوب."
          : "Uses YouTube's official player and the channel's official playlist; your position is saved per episode. Audio stops when the screen locks; YouTube may show ads."}
      </p>

      <div className="surah-tools">
        <label className="search-box">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث بعنوان الحلقة أو رقمها…" : "Search episodes…"} aria-label={ar ? "بحث في الحلقات" : "Search episodes"} inputMode="search" />
        </label>
        <div className="chips" role="group">
          <button className={`chip-btn ${!s.newestFirst ? "is-on" : ""}`} aria-pressed={!s.newestFirst} onClick={() => updateK((st) => ({ ...st, newestFirst: false }))}>
            {ar ? "من الأولى" : "First first"}
          </button>
          <button className={`chip-btn ${s.newestFirst ? "is-on" : ""}`} aria-pressed={!!s.newestFirst} onClick={() => updateK((st) => ({ ...st, newestFirst: true }))}>
            {ar ? "الأحدث أولًا" : "Newest first"}
          </button>
        </div>
        {s.ids.length > 0 && <p className="hint">{ar ? `${s.ids.length} حلقة في القائمة الرسمية.` : `${s.ids.length} episodes.`}</p>}
      </div>

      <ul className="surah-list">
        {rows.map(({ id, i, title }) => {
          const ep = s.eps[id];
          const pct = ep?.done ? 100 : ep?.dur ? Math.min(100, (ep.pos / ep.dur) * 100) : 0;
          return (
            <li key={id} className={`surah-row ${current === id || (!current && s.last?.id === id) ? "is-last" : ""}`}>
              <button
                className="surah-link"
                disabled={!ready && !failed}
                onClick={() => {
                  const at = ep && !ep.done ? ep.pos : 0;
                  if (failed) window.open(`https://www.youtube.com/watch?v=${id}&list=${KHILAFA.playlistId}&t=${at}s`, "_blank", "noopener");
                  else playAt(i, at);
                }}
              >
                <span className="surah-num" aria-hidden>
                  {i + 1}
                </span>
                <span className="surah-main">
                  <strong>{title || (ar ? `الحلقة ${i + 1}` : `Episode ${i + 1}`)}</strong>
                  <span className="muted small">
                    {ep?.done ? (ar ? "✓ شوهدت" : "✓ watched") : ep?.pos ? (
                      <>
                        {ar ? "توقفت عند " : "Stopped at "}
                        <bdi dir="ltr">{clock(ep.pos)}</bdi>
                      </>
                    ) : ep?.dur ? (
                      <bdi dir="ltr">{clock(ep.dur)}</bdi>
                    ) : null}
                  </span>
                  {pct > 0 && (
                    <span className="surah-bar" aria-hidden>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {ready && !s.ids.length && <li className="muted">{ar ? "تظهر الحلقات بعد تحميل المشغّل…" : "Episodes appear once the player loads…"}</li>}
      </ul>
      <p className="hint">
        <a href={KHILAFA.channelUrl} target="_blank" rel="noreferrer">
          {ar ? "قناة «نعرف» على يوتيوب" : "Ne3raf on YouTube"}
        </a>
      </p>
    </div>
  );
}
