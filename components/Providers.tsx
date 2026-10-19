"use client";
import { useEffect } from "react";
import { getState, loadStore, useAppState } from "@/lib/store";
import { player } from "@/lib/player/controller";

export function Providers({ children }: { children: React.ReactNode }) {
  const settings = useAppState((s) => s.settings);

  useEffect(() => {
    loadStore();
    player(); // create the single engine once, at app start
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Read the live store (not the render value): on the very first commit the render still holds
    // the server snapshot, which would briefly flip an English user back to RTL.
    const settings = getState().settings;
    const d = document.documentElement;
    d.lang = settings.lang;
    d.dir = settings.lang === "ar" ? "rtl" : "ltr";
    if (settings.theme === "system") delete d.dataset.theme;
    else d.dataset.theme = settings.theme;
    d.style.setProperty("--scale", String(settings.textScale));
    player().engine.lowData = settings.lowData;
  }, [settings]);

  return <>{children}</>;
}
