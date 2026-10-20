"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { update } from "@/lib/store";
import { addCustomStation } from "@/lib/state";
import { useT } from "@/lib/ui";

/** Add a station by name + stream URL. Saved on this device (included in Export). */
export function AddStationForm({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  let warn = "";
  try {
    if (url && new URL(url).protocol === "http:") warn = t.httpWarn;
  } catch {
    /* typing */
  }
  return (
    <form
      className="stack add-station"
      onSubmit={(e) => {
        e.preventDefault();
        let u: URL;
        try {
          u = new URL(url.trim());
          if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        } catch {
          return setErr(t.invalidUrl);
        }
        update((s) => addCustomStation(s, name.trim() || u.hostname, u.toString()));
        setName("");
        setUrl("");
        setErr("");
        onDone?.();
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} aria-label={t.name} maxLength={80} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label={t.streamUrl} inputMode="url" dir="ltr" autoCapitalize="off" autoCorrect="off" />
      {(err || warn) && <p className="hint warn">{err || warn}</p>}
      <button className="btn btn-gold" type="submit" disabled={!url}>
        <Icon name="plus" size={16} /> {t.add}
      </button>
    </form>
  );
}
