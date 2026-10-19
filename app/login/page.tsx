"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/ui";

function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Only same-origin relative paths are accepted as a post-login destination (no open redirect).
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";

  return (
    <main className="login">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setErr("");
          try {
            const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
            if (r.ok) {
              location.replace(next);
              return;
            }
            setErr(r.status === 429 ? t.loginLocked : r.status === 503 ? t.loginConfig : t.loginFail);
          } catch {
            setErr(t.offlineBanner);
          }
          setBusy(false);
        }}
      >
        <span className="brand-mark big" aria-hidden>
          <Icon name="radio" size={34} />
        </span>
        <h1>{t.appName}</h1>
        <p className="muted">{t.privateNote}</p>
        <label className="stack">
          <span className="sr-only">{t.password}</span>
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t.password} required autoFocus dir="ltr" />
        </label>
        {err && (
          <p className="hint warn" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-gold btn-block" type="submit" disabled={busy || !pw}>
          {busy ? "…" : t.login}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
