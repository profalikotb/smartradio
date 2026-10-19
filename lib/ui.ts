"use client";
import { useEffect, useState } from "react";
import { dict } from "./i18n";
import { useAppState } from "./store";

export function useLang() {
  return useAppState((s) => s.settings.lang);
}

export function useT() {
  return dict[useLang()];
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  return online;
}

/** Re-render every `ms` while `active` (for countdowns). */
export function useTicker(active: boolean, ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
