# Station catalog — verification report

Reviewed: **19/10/2026**. Source of truth in code: `lib/catalog.ts`.

**Method.** Identity was checked against an authoritative source (official site, Wikipedia station lists, recent Egyptian press). Stream records were checked in the Radio Browser directory (via its public mirror pages, since the API itself refused automated access from the build environment). **No stream URL is hard-coded**: verified stations store their Radio Browser UUID, and the app fetches the *current* URL from that record at play time (radiojar/shoutcast URLs rotate). Each live record is re-checked against the identity rule (Egypt + official homepage) before playing; if it drifted, playback is refused.

**Three separate signals are shown in the app and never merged:**
1. *Identity* — catalog-verified / confirmed-by-you / unverified
2. *Directory health* — Radio Browser `lastcheckok` + date
3. *Playback on this device* — last success timestamp, recorded only on a real `playing` event

## Core stations

| # | Station | Identity | Stream | Sources |
|---|---|---|---|---|
| 1 | إذاعة القرآن الكريم من القاهرة — Holy Quran Radio, Cairo | **Verified** 19/10/2026 | Radio Browser UUID `8e63e8b6-4e70-4bc0-9f5d-07e8477a4480`, homepage misrquran.gov.eg, MP3 over HTTPS (radiojar). Directory check OK 18/10/2026. | [misrquran.gov.eg](https://misrquran.gov.eg/) · [RB record (mirror)](https://radio.dubbeh.net/stations/st-8e63e8b6-17) · [facebook.com/quran.ertu](https://www.facebook.com/quran.ertu/) |
| 2 | إذاعة الأغاني المصرية — Al Aghani Radio | Identity confirmed (Egyptian Radio / Maspero, launched 17/06/2000, Cairo 105.8 FM, active per Masrawy 19/08/2026) | **Unverified — no official public HTTPS stream found.** Old official feed (elaghany.com) is defunct. App offers Egypt-only directory candidates for you to confirm. | [Wikipedia](https://en.wikipedia.org/wiki/Al_Aghani_Radio) · [List of Egyptian stations](https://en.wikipedia.org/wiki/List_of_radio_stations_in_Egypt) · [Masrawy](https://www.masrawy.com/news/news_egypt/details/2026/8/19/3035553) |

**Deliberately excluded look-alikes**
- “Radio Quran” (Egypt, homepage surahquran.com, 93.1) — third-party relay, not the official station.
- “إذاعة القرآن الكريم” listed under Iran (homepage holyquranradio.com) and Saudi Quran stations — different stations with the same Arabic name.
- Any “Aghani”/“Arabic Hits” station outside Egypt, and generic Arabic-music streams.

Quran frequency is intentionally not shown: sources disagree (98.2 vs 98.5 FM).

## Other stations

| Station | Status |
|---|---|
| Radio Hits 88.2 Cairo | **Verified** — RB UUID `b1d17829-6522-481b-bb5c-839c3fd44353`, homepage radiohits882.com, 128 kbps MP3 HTTPS |
| البرنامج العام · الشرق الأوسط (89.5) · صوت العرب · البرنامج الثقافي · البرنامج الموسيقي (98.8) · الشباب والرياضة (108) · راديو مصر · نجوم إف إم (100.6) · ميجا إف إم (92.7) · نغم إف إم (105.3) · إذاعة القاهرة الكبرى (102.2) · إذاعة الإسكندرية | **Unverified discovery entries.** Shown as “Unverified”; “Find stream” searches Radio Browser (Egypt only, strict name match) and lets you confirm a candidate. Frequencies from Wikipedia/Streema listings. |

## Re-verifying later

1. Open a station → **Find a stream** → review candidates (name, homepage, codec, directory check).
2. **Test** plays the candidate under its own directory name (not as the catalog station).
3. **This is the correct station** binds it on this device (shown as “Confirmed by you”, exported with your backup).
4. To promote a confirmed stream to the catalog for all devices: copy its UUID into `radioBrowserUuid` in `lib/catalog.ts`, add a `homepageHints` entry, set `identity.status: "catalog-verified"` with sources and date, commit, deploy.
