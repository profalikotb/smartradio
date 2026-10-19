"use client";
import { Icon } from "@/components/Icon";
import { VolumeControl } from "@/components/Player";
import { update, useAppState } from "@/lib/store";
import type { Settings } from "@/lib/state";
import { useT } from "@/lib/ui";

export default function SettingsPage() {
  const t = useT();
  const st = useAppState((s) => s.settings);
  const set = (p: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...p } }));

  return (
    <div className="page">
      <h1 className="page-title">{t.settings}</h1>

      <section className="panel">
        <div className="setting">
          <span>{t.language}</span>
          <div className="seg" role="radiogroup" aria-label={t.language}>
            <button role="radio" aria-checked={st.lang === "ar"} className={st.lang === "ar" ? "on" : ""} onClick={() => set({ lang: "ar" })}>العربية</button>
            <button role="radio" aria-checked={st.lang === "en"} className={st.lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>English</button>
          </div>
        </div>
        <div className="setting">
          <span>{t.theme}</span>
          <div className="seg" role="radiogroup" aria-label={t.theme}>
            {(["system", "light", "dark"] as const).map((v) => (
              <button key={v} role="radio" aria-checked={st.theme === v} className={st.theme === v ? "on" : ""} onClick={() => set({ theme: v })}>
                {v === "system" ? t.themeSystem : v === "light" ? t.themeLight : t.themeDark}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span>{t.textSize}</span>
          <div className="seg" role="radiogroup" aria-label={t.textSize}>
            {[1, 1.15, 1.3].map((v, i) => (
              <button key={v} role="radio" aria-checked={st.textScale === v} className={st.textScale === v ? "on" : ""} onClick={() => set({ textScale: v })} style={{ fontSize: `${0.9 + i * 0.15}rem` }}>
                {["A", "A+", "A++"][i]}
              </button>
            ))}
          </div>
        </div>
        <label className="setting">
          <span>
            {t.lowData}
            <small className="hint block">{t.lowDataNote}</small>
          </span>
          <input type="checkbox" className="switch" checked={st.lowData} onChange={(e) => set({ lowData: e.target.checked })} />
        </label>
        <div className="setting column">
          <span>{t.volume}</span>
          <VolumeControl />
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">
          <Icon name="shield" size={18} /> {t.privateNote}
        </h2>
        <p className="hint">{t.privacyNote}</p>
        <p className="hint">{t.localNote}</p>
        <button
          className="btn btn-danger"
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" }).catch(() => {});
            location.href = "/login";
          }}
        >
          {t.logout}
        </button>
      </section>
    </div>
  );
}
