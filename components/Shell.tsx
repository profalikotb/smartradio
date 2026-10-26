"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { BottomPlayer } from "./Player";
import { useOnline, useT } from "@/lib/ui";
import { useEffect } from "react";
import { wireTafsirProgress } from "@/lib/tafsir/client";
import { update } from "@/lib/store";

const NAV = [
  { href: "/", key: "home", icon: "home" },
  { href: "/search", key: "search", icon: "search" },
  { href: "/favorites", key: "favorites", icon: "star" },
  { href: "/tafsir", key: "tafsir", icon: "quran" },
  { href: "/settings", key: "settings", icon: "gear" },
] as const;

const isOn = (path: string, href: string) => path === href || (href !== "/" && path.startsWith(href + "/"));

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const t = useT();
  const online = useOnline();
  // Saves Tafsir listening position (periodically, on pause, on episode change, when hidden).
  useEffect(() => wireTafsirProgress(), []);
  if (path === "/login") return <>{children}</>;
  const immersive = path === "/focus" || path === "/drive";

  return (
    <div className={`shell ${immersive ? "is-immersive" : ""}`}>
      {!immersive && (
        <header className="topbar">
          <Link href="/" className="brand" aria-label={t.home}>
            <span className="brand-mark" aria-hidden>
              <Icon name="radio" size={20} />
            </span>
            <span className="brand-text">{t.appName}</span>
          </Link>
          <div className="topbar-actions">
            <Link href="/drive" className="icon-btn" aria-label={t.drive} title={t.drive}>
              <Icon name="car" />
            </Link>
            <button
              className="chip-btn"
              onClick={() => update((s) => ({ ...s, settings: { ...s.settings, lang: s.settings.lang === "ar" ? "en" : "ar" } }))}
              aria-label="Language / اللغة"
            >
              <Icon name="globe" size={18} /> {t.langSwitch}
            </button>
          </div>
        </header>
      )}

      {!online && (
        <div className="banner banner-offline" role="status">
          <Icon name="wifiOff" size={18} /> {t.offlineBanner}
        </div>
      )}

      <div className="layout">
        {!immersive && (
          <nav className="sidenav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`nav-item ${isOn(path, n.href) ? "active" : ""}`} aria-current={isOn(path, n.href) ? "page" : undefined}>
                <Icon name={n.icon} />
                <span>{t[n.key]}</span>
              </Link>
            ))}
            <Link href="/drive" className={`nav-item ${path === "/drive" ? "active" : ""}`}>
              <Icon name="car" />
              <span>{t.drive}</span>
            </Link>
            <Link href="/help" className={`nav-item ${path === "/help" ? "active" : ""}`}>
              <Icon name="info" />
              <span>{t.help}</span>
            </Link>
          </nav>
        )}
        <main className="content" id="main">
          {children}
        </main>
      </div>

      <BottomPlayer hidden={immersive} />

      {!immersive && (
        <nav className="tabbar" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`tab ${isOn(path, n.href) ? "active" : ""}`} aria-current={isOn(path, n.href) ? "page" : undefined}>
              <Icon name={n.icon} size={22} />
              <span>{t[n.key]}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
