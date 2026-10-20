"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { StationRow } from "@/components/Stations";
import { AddStationForm } from "@/components/AddStation";
import { replaceState, getState, update, useAppState } from "@/lib/store";
import { exportState, importState, ImportError, moveFavorite, removeGroup, setNickname, toggleInGroup, upsertGroup } from "@/lib/state";
import { viewOf } from "@/lib/stations";
import { fmt } from "@/lib/i18n";
import { useLang, useMounted, useT } from "@/lib/ui";

export default function FavoritesPage() {
  const t = useT();
  const lang = useLang();
  const mounted = useMounted();
  const favorites = useAppState((s) => s.favorites);
  const groups = useAppState((s) => s.groups);
  const nicknames = useAppState((s) => s.nicknames);
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!mounted) return <div className="page" />;

  const group = groups.find((g) => g.id === activeGroup);
  const ids = group ? favorites.filter((id) => group.stationIds.includes(id)).concat(group.stationIds.filter((id) => !favorites.includes(id))) : favorites;

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportState(getState()), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    a.href = URL.createObjectURL(blob);
    a.download = `smart-radio-backup-${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const doImport = async (f: File) => {
    try {
      if (f.size > 2_000_000) throw new ImportError("file-too-large");
      const parsed = JSON.parse(await f.text());
      replaceState(importState(getState(), parsed));
      setMsg({ ok: true, text: t.importOk });
    } catch (e) {
      setMsg({ ok: false, text: fmt(t.importFail, { e: e instanceof ImportError ? e.message : "invalid-json" }) });
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t.favorites}</h1>

      <div className="tabs" role="tablist" aria-label={t.groups}>
        <button role="tab" aria-selected={activeGroup === "all"} className={`tab-chip ${activeGroup === "all" ? "active" : ""}`} onClick={() => setActiveGroup("all")}>
          {t.favorites} <span className="count">{favorites.length}</span>
        </button>
        {groups.map((g) => (
          <button key={g.id} role="tab" aria-selected={activeGroup === g.id} className={`tab-chip ${activeGroup === g.id ? "active" : ""}`} onClick={() => setActiveGroup(g.id)}>
            {g.name} <span className="count">{g.stationIds.length}</span>
          </button>
        ))}
        <button
          className="tab-chip"
          onClick={() => {
            const name = prompt(t.newGroup)?.trim();
            if (name) update((s) => upsertGroup(s, { id: `g-${Date.now().toString(36)}`, name: name.slice(0, 40), stationIds: [] }));
          }}
          aria-label={t.newGroup}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>

      {group && (
        <div className="row gap-s group-tools">
          <button
            className="btn btn-sm"
            onClick={() => {
              const name = prompt(t.newGroup, group.name)?.trim();
              if (name) update((s) => upsertGroup(s, { ...group, name: name.slice(0, 40) }));
            }}
          >
            <Icon name="edit" size={14} /> {lang === "ar" ? "إعادة تسمية" : "Rename"}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(lang === "ar" ? `حذف مجموعة «${group.name}»؟ (المحطات تبقى في المفضلة)` : `Delete group “${group.name}”? (Stations stay in favorites)`)) {
                update((s) => removeGroup(s, group.id));
                setActiveGroup("all");
              }
            }}
          >
            {lang === "ar" ? "حذف المجموعة" : "Delete group"}
          </button>
        </div>
      )}

      {ids.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <ul className="station-list">
          {ids.map((id) => {
            const v = viewOf(id);
            const i = favorites.indexOf(id);
            return (
              <li key={id} className="fav-item">
                <ul className="station-list nested">
                  <StationRow
                    id={id}
                    extra={
                      activeGroup === "all" && i >= 0 ? (
                        <span className="reorder">
                          <button className="icon-btn" disabled={i === 0} onClick={() => update((s) => moveFavorite(s, id, -1))} aria-label={t.moveUp}>
                            <Icon name="up" />
                          </button>
                          <button className="icon-btn" disabled={i === favorites.length - 1} onClick={() => update((s) => moveFavorite(s, id, 1))} aria-label={t.moveDown}>
                            <Icon name="down" />
                          </button>
                        </span>
                      ) : null
                    }
                  />
                </ul>
                <div className="fav-tools">
                  {editing === id ? (
                    <form
                      className="row gap-s"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = new FormData(e.currentTarget).get("nick");
                        update((s) => setNickname(s, id, String(val ?? "")));
                        setEditing(null);
                      }}
                    >
                      <input name="nick" defaultValue={nicknames[id] ?? ""} placeholder={v ? (lang === "ar" ? v.nameAr : v.nameEn) : ""} aria-label={t.nickname} autoFocus maxLength={60} />
                      <button className="btn btn-sm btn-gold" type="submit">✓</button>
                    </form>
                  ) : (
                    <button className="link-btn" onClick={() => setEditing(id)}>
                      <Icon name="edit" size={14} /> {t.nickname}
                      {nicknames[id] ? `: ${nicknames[id]}` : ""}
                    </button>
                  )}
                  <span className="group-toggles">
                    {groups.map((g) => (
                      <label key={g.id} className="mini-check">
                        <input type="checkbox" checked={g.stationIds.includes(id)} onChange={() => update((s) => toggleInGroup(s, g.id, id))} />
                        {g.name}
                      </label>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CustomStationForm />

      <section className="panel">
        <h2 className="section-title">{lang === "ar" ? "النسخ الاحتياطي" : "Backup"}</h2>
        <p className="hint">{t.localNote}</p>
        <div className="row gap-s wrap">
          <button className="btn" onClick={doExport}>
            <Icon name="down" size={16} /> {t.exportData}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="up" size={16} /> {t.importData}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </div>
        {msg && (
          <p className={`banner ${msg.ok ? "banner-ok" : "banner-warn"}`} role="status">
            {msg.text}
          </p>
        )}
      </section>
    </div>
  );
}

function CustomStationForm() {
  const t = useT();
  return (
    <section className="panel">
      <h2 className="section-title">{t.addCustom}</h2>
      <AddStationForm />
    </section>
  );
}
