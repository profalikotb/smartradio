# Prof Ali Kotb Smart Radio · راديو أ.د. على قطب الذكي

Private, bilingual (Arabic RTL default / English LTR) live-radio PWA for iPhone and desktop.
Next.js 15 + TypeScript, deployed on Vercel, password-protected end to end.

- Core stations, pinned in fixed order: **إذاعة القرآن الكريم من القاهرة** → **إذاعة الأغاني المصرية**
- Arabic/English search with normalization, aliases, typo tolerance, filters, de-duplication
- One persistent player, bounded retries, offline/online recovery, no overlapping audio
- Favorites (reorder, nicknames, groups, pins, recent), JSON export/import, custom stations
- Quran focus mode, driving view, sleep timer, low-data mode, connection panel
- No hard-coded stream URLs, no fake logos/metadata, no substitutes

See [`docs/STATIONS.md`](docs/STATIONS.md) for the verified catalog and [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) for what the platform cannot do.

---

## 1. Local run

```bash
npm install
npm run hash-password          # prompts for a password (≥12 chars), prints APP_PASSWORD_HASH + SESSION_SECRET
cp .env.example .env.local     # paste the two values
npm run dev                    # http://localhost:3000
npm test                       # 85 unit tests
npm run typecheck && npm run build
```

## 2. GitHub

```bash
git init && git add -A && git commit -m "Prof Ali Kotb Smart Radio v1"
gh repo create prof-ali-kotb-smart-radio --private --source=. --push
# or: create an empty PRIVATE repo on github.com, then
git remote add origin git@github.com:<you>/prof-ali-kotb-smart-radio.git && git push -u origin main
```

`.env*` files are git-ignored. Never commit secrets.

## 3. Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo. Framework: Next.js (auto). No build overrides.
2. **Settings → Environment Variables** (Production **and** Preview):
   | Name | Value |
   |---|---|
   | `APP_PASSWORD_HASH` | from `npm run hash-password` (format `scrypt:N:r:p:salt:hash`) |
   | `SESSION_SECRET` | from the same command (≥32 chars) |
   | `SESSION_DAYS` | optional, default `180` |
   | `DIRECTORY_USER_AGENT` | optional contact string for Radio Browser (e.g. your domain) |
3. **Deploy.** Then **Settings → Functions → Region**: pick `fra1` (Frankfurt) — closest to Cairo and to Radio Browser's German mirrors.
4. Optional custom domain: **Settings → Domains**.

Changing the password: run `npm run hash-password` again, replace `APP_PASSWORD_HASH`, and also replace `SESSION_SECRET` to sign out every device. Redeploy.

## 4. Private access — how it works

- `middleware.ts` gates **every** page and API route. Without a valid session cookie: pages redirect to `/login`, APIs return `401`. Missing env vars → fail closed (nobody can sign in).
- Single owner, no registration. Password is checked server-side with scrypt; nothing secret ships to the browser.
- Session: signed JWT (HS256) in an `httpOnly`, `Secure`, `SameSite=Lax` cookie, 180 days — so the installed iPhone PWA (which has its own cookie jar, separate from Safari) asks for the password once.
- Public by design (no personal data): `/_next/static`, `/icons/*`, `/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/robots.txt`. Everything sends `X-Robots-Tag: noindex`.
- Login throttle is best-effort (per serverless instance). For stronger protection, additionally enable **Vercel → Settings → Deployment Protection** (Vercel Authentication or Password Protection, plan-dependent). Note: Vercel Authentication on Production can interfere with PWA installation on iOS; the app's own login is sufficient on its own.
- Security headers: strict CSP (`frame-ancestors 'none'`, same-origin scripts), HSTS, `Permissions-Policy` denying geolocation/camera/mic, `Referrer-Policy: no-referrer`.

## 5. Architecture

```
app/                     pages (all client-rendered; data is on-device) + API routes
  api/login|logout       scrypt check → session cookie
  api/directory          Radio Browser JSON proxy (metadata only; mirror discovery; 6 s/mirror; 503 on outage)
  api/resolve-playlist   .pls/.m3u → stream URLs, SSRF-guarded (public IPs only, pinned DNS, ≤3 redirects, 64 KB, 6 s)
lib/player/engine.ts     the single audio engine (state machine, generations, timeouts, backoff, sleep timer)
lib/player/controller.ts station lookup, cache-first start, Media Session, online/offline wiring, iOS unlock
lib/catalog.ts           curated Egyptian catalog (identity + sources; no stream URLs)
lib/match.ts             strict candidate/identity rules (Egypt + name + homepage)
lib/search/*             normalization, NL query parsing, ranking, de-dup
lib/state.ts             pure state + reducers + one-time seeding + export/import validation
lib/store.ts             localStorage persistence (corrupt data backed up, never silently dropped)
middleware.ts            auth gate
public/sw.js             app-shell cache; never caches audio or API
```

**Why no audio relay:** streams play directly from the broadcaster's HTTPS host. Vercel functions only move small JSON/text. No relay is configured; if a future station is HTTP-only, a relay would need a long-lived host (not Vercel Functions) and the broadcaster's permission — documented as unavailable rather than faked.

## 6. Tests (`npm test`)

| File | Covers |
|---|---|
| `tests/search.test.ts` | Arabic normalization (أ/إ/آ, ى/ي, ة/ه, harakat, tatweel), NL parsing («إذاعة القرآن المصرية»), Quran/Aghani aliases + typos, look-alike ranking, catalog/directory folding, filters, de-dup |
| `tests/state.test.ts` | first-run seed order, **removed core station stays removed** across reload/update, order preserved, future-seed merge, corrupt storage, export/import round-trip + validation |
| `tests/engine.test.ts` | real playing-state only, autoplay block, external pause, timeout → backoff → alternative → unavailable (bounded), never another station, HTTP-only reporting, offline/online, **never restart after intentional pause**, **rapid switching** (stale async/timers ignored, single element), low-data, sleep timer + overdue enforcement |
| `tests/match.test.ts` | Egypt+homepage rule rejects surahquran.com / Iranian / Lebanese / generic music look-alikes |
| `tests/auth.test.ts` | scrypt verify, malformed/weak hashes, JWT tamper/secret rotation, fail-closed |
| `tests/netguard.test.ts` | private/metadata IPs, protocol/port/credential/host blocks, .pls/.m3u/HLS parsing |

---

## تعليمات الاستخدام (عربي)

- **التشغيل:** اضغط بطاقة «إذاعة القرآن الكريم من القاهرة» أو «إذاعة الأغاني المصرية» في الرئيسية. أول تشغيل يحتاج ضغطة (سياسة المتصفح).
- **المشغّل** في الأسفل يستمر أثناء التنقل. اضغط اسم المحطة لفتح: مؤقت النوم، حالة الاتصال، استهلاك البيانات (تقديري)، التفاصيل.
- **انقطاع الإنترنت:** تظهر رسالة واضحة. إذا كنت تستمع يعود البث تلقائيًا عند عودة الاتصال؛ إذا أوقفته بنفسك لا يعود أبدًا.
- **إذاعة الأغاني:** غير موثقة حتى الآن (لا يوجد بث رسمي عام موثّق). افتح تفاصيلها ← «البحث عن بث لهذه المحطة» ← جرّب المرشح ← «هذه هي المحطة الصحيحة». لا يُشغَّل بديل تلقائيًا.
- **المفضلة:** نجمة للإضافة، أسهم للترتيب، دبوس للتثبيت، اسم مختصر، مجموعات. محفوظة على الجهاز فقط — استخدم «تصدير» و«استيراد» للنسخ الاحتياطي والنقل.
- **iPhone:** Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم سجّل الدخول مرة واحدة داخل التطبيق. الصوت من أزرار الجهاز.
- **الخصوصية:** لا إعلانات، لا تحليلات، لا طلب موقع. خادم البث يرى عنوان IP عند التشغيل.

## User instructions (English)

- **Play:** tap a core station card on Home. The first play needs a tap (browser policy).
- **Player** stays at the bottom across pages; tap the station name for sleep timer, connection info, estimated data use, details.
- **Connection loss:** clear status; auto-resume only if you were listening; never after you paused.
- **Al Aghani:** unverified for now. Open its details → “Find a stream for this station” → Test → “This is the correct station”. Nothing substitutes automatically.
- **Favorites:** star, reorder arrows, pin, nickname, groups. Stored on this device — use Export/Import to back up or move.
- **iPhone:** Safari → Share → Add to Home Screen, then sign in once inside the app. Use hardware volume buttons.
