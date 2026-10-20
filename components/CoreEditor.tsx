"use client";
import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Stations";
import { AddStationForm } from "./AddStation";
import { CATALOG } from "@/lib/catalog";
import { useAppState, update } from "@/lib/store";
import { toggleCore } from "@/lib/state";
import { displayName, viewOf } from "@/lib/stations";
import { normalize } from "@/lib/search/normalize";
import { useLang, useT } from "@/lib/ui";

/** Picker shown under المحطات الأساسية in edit mode: add any existing station, or a new one by URL. */
export function CoreEditor() {
  const t = useT();
  const lang = useLang();
  const core = useAppState((s) => s.core);
  const hidden = useAppState((s) => s.hidden);
  const custom = useAppState((s) => s.custom);
  const favorites = useAppState((s) => s.favorites);
  const nick = useAppState((s) => s.nicknames);
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    const ids = [...new Set([...CATALOG.map((c) => c.id), ...custom.map((c) => `custom:${c.id}`), ...favorites])];
    return ids.filter((id) => !core.includes(id) && !hidden.includes(id) && viewOf(id));
  }, [core, hidden, custom, favorites]);

  const nq = normalize(q);
  const shown = candidates.filter((id) => {
    if (!nq) return true;
    const v = viewOf(id)!;
    return [v.nameAr, v.nameEn, nick[id] ?? ""].some((n) => normalize(n).includes(nq));
  });

  return (
    <div className="panel core-editor">
      <h3 className="sub-title">{t.coreAddExisting}</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.filter} aria-label={t.filter} />
      <ul className="pick-list">
        {shown.map((id) => {
          const v = viewOf(id)!;
          return (
            <li key={id}>
              <button className="pick-item" onClick={() => update((s) => toggleCore(s, id))}>
                <Logo id={id} size={34} />
                <span className="pick-name">{displayName(v, lang, nick)}</span>
                {v.frequency && <bdi dir="ltr" className="muted small">{v.frequency}</bdi>}
                <Icon name="plus" size={18} />
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="muted small">{t.empty}</li>}
      </ul>
      <h3 className="sub-title">{t.coreAddNew}</h3>
      <AddStationForm toCore />
    </div>
  );
}
