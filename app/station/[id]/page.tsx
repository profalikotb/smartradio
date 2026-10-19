"use client";
import { use, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { IdentityBadge, Logo, useStationStatus } from "@/components/Stations";
import { isActive, LiveBadge, statusLabel } from "@/components/Player";
import { hasEmbed, openEmbed } from "@/components/OfficialPlayer";
import { directory, DirectoryError } from "@/lib/directoryClient";
import { player } from "@/lib/player/controller";
import { dedupe, hostOf } from "@/lib/search/rank";
import { confirmBinding, displayName, playableFromDirectory, rememberDirectoryStation, removeBinding, viewOf } from "@/lib/stations";
import { useAppState, update } from "@/lib/store";
import { toggleFavorite } from "@/lib/state";
import type { DirectoryStation, StreamRef } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/i18n";
import { useLang, useMounted, useT } from "@/lib/ui";

export default function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const t = useT();
  const lang = useLang();
  const mounted = useMounted();
  const nick = useAppState((s) => s.nicknames);
  const known = useAppState((s) => s.known[id]);
  const binding = useAppState((s) => s.bindings[id]);
  const fav = useAppState((s) => s.favorites.includes(id));
  const { current, ui, info } = useStationStatus(id);
  if (!mounted) return <div className="page" />;
  const v = viewOf(id);
  if (!v) return <div className="page"><p className="muted">{t.resolve["not-found"]}</p></div>;
  const c = v.catalog;
  const streams: StreamRef[] = binding ? [binding.stream, ...binding.alternatives] : known?.streams ?? [];
  const active = current && ui && isActive(ui.status);

  return (
    <div className="page station-page">
      <header className="station-head">
        <Logo id={id} size={84} />
        <div>
          <h1 className="page-title">{displayName(v, lang, nick)}</h1>
          <p className="muted">
            {lang === "ar" ? v.nameEn : v.nameAr}
            {v.frequency ? ` · ${v.frequency}` : ""}
          </p>
          <p className="row gap-s wrap">
            <IdentityBadge v={v} />
            {c?.core && <span className="badge badge-gold">{t.core}</span>}
            <span className="badge badge-neutral">{t.categories[v.category]}</span>
          </p>
        </div>
      </header>

      <div className="row gap-s wrap">
        <button className="btn btn-gold" onClick={() => (v.identity === "unverified" && hasEmbed(id) ? openEmbed(id) : active ? player().stop() : player().playById(id))}>
          <Icon name={active ? "stop" : "play"} size={18} /> {active ? t.stop : t.play}
        </button>
        <button className={`btn ${fav ? "is-on" : ""}`} onClick={() => update((s) => toggleFavorite(s, id))} aria-pressed={fav}>
          <Icon name="star" size={18} /> {fav ? t.removeFav : t.addFav}
        </button>
        {current && ui && (
          <span className={`status-pill st-${ui.status}`}>
            <LiveBadge status={ui.status} /> {ui.status === "playing" ? t.liveBroadcast : statusLabel(ui.status, t)}
          </span>
        )}
      </div>
      {current && ui?.message && (
        <p className="banner banner-warn">
          {ui.message}{" "}
          <button className="btn btn-sm btn-gold" onClick={() => player().retry()}>
            {t.retry}
          </button>
        </p>
      )}

      <section className="panel">
        <dl className="kv">
          <dt>{t.lastOkHere}</dt>
          <dd>{info?.lastOkAt ? fmtDateTime(info.lastOkAt, lang) : t.never}</dd>
          {info?.lastErrorAt && (
            <>
              <dt>{lang === "ar" ? "آخر خطأ" : "Last error"}</dt>
              <dd>
                {fmtDateTime(info.lastErrorAt, lang)} · {info.lastError}
              </dd>
            </>
          )}
          {v.website && (
            <>
              <dt>{t.website}</dt>
              <dd>
                <a href={v.website} target="_blank" rel="noopener noreferrer" dir="ltr">
                  {hostOf(v.website) || v.website}
                </a>
              </dd>
            </>
          )}
          {c?.identity.verifiedOn && (
            <>
              <dt>{t.verifiedOn}</dt>
              <dd>{c.identity.verifiedOn}</dd>
            </>
          )}
          {binding && (
            <>
              <dt>{t.userConfirmed}</dt>
              <dd>
                {binding.directoryName} · {fmtDate(binding.confirmedAt)}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="panel">
        <h2 className="section-title">{t.alternatives}</h2>
        {streams.length ? (
          <ul className="stream-list">
            {streams.map((s) => (
              <li key={s.url}>
                <code dir="ltr">{hostOf(s.url)}</code>
                <span className="muted small">
                  {s.codec ?? "?"} {s.bitrate ? `· ${s.bitrate} kbps` : ""} {s.hls ? "· HLS" : ""} {!s.url.startsWith("https:") ? "· HTTP ⚠" : ""}
                </span>
                {s.directoryOk !== undefined && (
                  <span className={`badge ${s.directoryOk ? "badge-neutral" : "badge-warn"}`}>
                    {s.directoryOk ? t.directoryOk : t.directoryFail}
                    {s.directoryCheckedAt ? ` · ${fmtDate(s.directoryCheckedAt)}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{c?.radioBrowserUuid ? (lang === "ar" ? "يُجلب رابط البث الحالي عند التشغيل." : "The current stream address is fetched when you play.") : t.errors["no-stream"]}</p>
        )}
        <p className="hint">{t.directoryNote}</p>
        {binding && (
          <button className="btn btn-sm btn-danger" onClick={() => removeBinding(id)}>
            {t.removeBinding}
          </button>
        )}
      </section>

      {c && c.identity.status === "unverified" && !hasEmbed(id) && <Candidates catalogId={c.id} />}

      {c && (
        <section className="panel">
          <h2 className="section-title">{t.sources}</h2>
          <p className="hint">{c.identity.note}</p>
          <ul className="source-list">
            {c.identity.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="hint">{t.privacyNote}</p>
    </div>
  );
}

function Candidates({ catalogId }: { catalogId: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "loading" | "done" | DirectoryError["kind"]>("idle");
  const [groups, setGroups] = useState<DirectoryStation[][]>([]);
  const bound = useAppState((s) => s.bindings[catalogId]);

  useEffect(() => setState("idle"), [catalogId]);

  const find = async () => {
    setState("loading");
    try {
      const list = await directory.candidates(catalogId);
      setGroups(dedupe(list));
      setState("done");
    } catch (e) {
      setState(e instanceof DirectoryError ? e.kind : "error");
    }
  };

  return (
    <section className="panel">
      <h2 className="section-title">{t.candidatesTitle}</h2>
      <p className="hint">{t.candidatesNote}</p>
      <button className="btn" onClick={find} disabled={state === "loading"}>
        <Icon name="search" size={16} /> {state === "loading" ? t.searching : t.findStream}
      </button>
      {(state === "unavailable" || state === "error" || state === "timeout" || state === "offline") && <p className="banner banner-warn">{state === "offline" ? t.directoryOffline : t.directoryDown}</p>}
      {state === "done" && !groups.length && <p className="muted">{t.noCandidates}</p>}
      <ul className="candidate-list">
        {groups.map((g) => {
          const d = g[0]!;
          const st = playableFromDirectory(g);
          const isBound = bound?.rbUuid === d.uuid;
          return (
            <li key={d.uuid} className="candidate">
              <div>
                <strong dir="auto">{d.name}</strong>
                <div className="muted small" dir="ltr">
                  {hostOf(d.homepage) || "—"} · {d.codec || "?"} {d.bitrate ? `${d.bitrate}k` : ""} · {d.countrycode}
                </div>
                <span className={`badge ${d.lastcheckok ? "badge-neutral" : "badge-warn"}`}>{d.lastcheckok ? t.directoryOk : t.directoryFail}</span>
                {g.length > 1 && <span className="badge badge-neutral">×{g.length}</span>}
              </div>
              <div className="row gap-s">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    rememberDirectoryStation(st); // plays under ITS OWN directory name, not as the catalog station
                    player().playById(st.id);
                  }}
                >
                  <Icon name="play" size={14} /> {t.test}
                </button>
                <button className="btn btn-sm btn-gold" disabled={isBound} onClick={() => confirmBinding(catalogId, g)}>
                  {isBound ? "✓" : t.confirmThis}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
