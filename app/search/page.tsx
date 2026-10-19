"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { StationRow } from "@/components/Stations";
import { directory, DirectoryError } from "@/lib/directoryClient";
import { player } from "@/lib/player/controller";
import { parseQuery } from "@/lib/search/query";
import { runSearch } from "@/lib/search/index";
import type { Filters } from "@/lib/search/rank";
import { playableFromDirectory, rememberDirectoryStation, type StationView } from "@/lib/stations";
import { useAppState } from "@/lib/store";
import type { Category, DirectoryStation } from "@/lib/types";
import { fmt, fmtDate } from "@/lib/i18n";
import { useT } from "@/lib/ui";

const CATS: Category[] = ["quran", "religious", "news", "culture", "sports", "music", "regional"];

export default function SearchPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<"" | "EG">("");
  const [category, setCategory] = useState<"" | Category>("");
  const [minBitrate, setMinBitrate] = useState(0);
  const [dir, setDir] = useState<DirectoryStation[]>([]);
  const [dirState, setDirState] = useState<"idle" | "loading" | "ok" | DirectoryError["kind"]>("idle");
  const bindings = useAppState((s) => s.bindings);
  const playback = useAppState((s) => s.playback);
  const custom = useAppState((s) => s.custom);
  const nicknames = useAppState((s) => s.nicknames);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced, cancellable directory search. Stale responses are dropped via AbortController.
  useEffect(() => {
    const parsed = parseQuery(q);
    const text = parsed.terms.join(" ");
    if (text.length < 2) {
      setDir([]);
      setDirState("idle");
      return;
    }
    const ctrl = new AbortController();
    const cc = country || parsed.country;
    const timer = setTimeout(async () => {
      setDirState("loading");
      try {
        let list = await directory.search(text, cc, ctrl.signal);
        if (!list.length && parsed.terms.length > 1) {
          const longest = [...parsed.terms].sort((a, b) => b.length - a.length)[0]!;
          list = await directory.search(longest, cc, ctrl.signal);
        }
        if (!ctrl.signal.aborted) {
          setDir(list);
          setDirState("ok");
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setDir([]);
        setDirState(e instanceof DirectoryError ? e.kind : "error");
      }
    }, 320);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, country]);

  const filters: Filters = { country: country || undefined, category: category || undefined, minBitrate: minBitrate || undefined };
  const results = useMemo(
    () => (q.trim() ? runSearch(q, filters, { bindings, playback, custom, nicknames }, dir) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, country, category, minBitrate, dir, bindings, playback, custom, nicknames],
  );

  return (
    <div className="page">
      <h1 className="page-title">{t.search}</h1>
      <div className="search-box">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.search}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {q && (
          <button className="icon-btn" onClick={() => setQ("")} aria-label={t.cancel}>
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className="filters" role="group" aria-label="Filters">
        <select value={country} onChange={(e) => setCountry(e.target.value as "" | "EG")} aria-label="Country">
          <option value="">{t.allCountries}</option>
          <option value="EG">{t.egyptOnly}</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as "" | Category)} aria-label="Category">
          <option value="">{t.anyCategory}</option>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
        <select value={minBitrate} onChange={(e) => setMinBitrate(Number(e.target.value))} aria-label={t.bitrate}>
          <option value={0}>{t.anyQuality}</option>
          {[64, 96, 128].map((n) => (
            <option key={n} value={n}>
              {fmt(t.minKbps, { n })}
            </option>
          ))}
        </select>
      </div>

      {dirState === "loading" && <p className="muted small">{t.searching}</p>}
      {(dirState === "unavailable" || dirState === "error" || dirState === "timeout") && <p className="banner banner-warn">{t.directoryDown}</p>}
      {dirState === "offline" && <p className="banner banner-warn">{t.directoryOffline}</p>}

      {q.trim() && !results.length && dirState !== "loading" && <p className="muted">{t.noResults}</p>}

      <ul className="station-list">
        {results.map((r) => {
          if (r.entry.source !== "directory" || !r.group) return <StationRow key={r.entry.key} id={r.entry.key} />;
          const st = playableFromDirectory(r.group);
          const d = r.group[0]!;
          const view: StationView = { ...st, core: false };
          return (
            <StationRow
              key={r.entry.key}
              id={st.id}
              view={view}
              onRemember={() => rememberDirectoryStation(st)}
              onPlay={() => {
                rememberDirectoryStation(st);
                player().playById(st.id);
              }}
              extra={
                <span className="dir-meta" title={t.directoryNote}>
                  <span className={`badge ${d.lastcheckok ? "badge-neutral" : "badge-warn"}`}>
                    {d.lastcheckok ? t.directoryOk : t.directoryFail}
                    {d.lastcheckoktime ? ` · ${fmtDate(d.lastcheckoktime)}` : ""}
                  </span>
                  <span className="muted small">
                    {d.countrycode || "—"}
                    {d.bitrate ? ` · ${d.bitrate}k` : ""}
                    {r.group.length > 1 ? ` · ×${r.group.length}` : ""}
                  </span>
                </span>
              }
            />
          );
        })}
      </ul>
      {results.some((r) => r.entry.source === "directory") && <p className="hint">{t.directoryNote}</p>}
    </div>
  );
}
