# Platform limitations and what was not verified

## Not verified in this build
- **Real audio playback was not tested.** The build environment had no network route to Radio Browser or stream hosts. All playback logic is covered by unit tests with a simulated audio element; first real-device check is on you (5 minutes — see checklist below).
- **iPhone Safari / installed PWA / desktop browsers were not tested on real devices.** Layouts were checked in headless Chromium at 390×844 (mobile) and 1366×860 (desktop), Arabic + English, light + dark.
- **Al Aghani:** no official, publicly accessible stream could be verified. It stays pinned with “Unverified” + Retry + Find stream.
- 12 other Egyptian stations are discovery entries only (see `STATIONS.md`).

## Browser / OS limits (by design, not bugs)
- **First play needs a tap.** The app unlocks the audio element inside your tap, so later station switches work without extra taps.
- **iOS ignores web volume control** → device buttons only; sleep-timer fade is skipped on iPhone (it stops cleanly instead).
- **Background playback is not guaranteed.** iOS may suspend the PWA; the sleep timer is enforced when you return if it fired late.
- **No alarm** can start the radio while the app is closed.
- **HTTP-only streams:** an HTTPS app cannot play plain HTTP. The browser tries the HTTPS version of the same host; if that fails the station shows “HTTP-only”. No relay is configured (Vercel Functions are unsuitable for continuous audio; a relay would need a long-lived host and the broadcaster's permission).
- **Live metadata:** Radio Browser/streams don't reliably supply program names, so the app always shows “Live broadcast / بث مباشر”. No visualizer (cross-origin audio can't be analysed); the live dot reflects the real `playing` state.
- **Favorites are device-local** (localStorage). iPhone PWA storage is separate from Safari's and iOS may evict it after long inactivity — export a backup.
- **Login throttle** is per serverless instance (best-effort); scrypt cost + 600 ms delay are the real brake.
- **Privacy:** stream servers see your IP and normal connection details when you play.

## Real-device checklist (iPhone + desktop)
1. Sign in → Home shows Quran first, Aghani second.
2. Tap Quran → “Playing” within ~5 s; navigate Search → Favorites → back: audio continues.
3. Lock the phone: Control Center shows station name with play/pause.
4. Airplane mode → “Offline”; turn it off → resumes automatically. Pause, then toggle airplane mode → stays paused.
5. Tap Quran, Aghani, Quran quickly → only one plays, no overlap.
6. Sleep timer 15 min → stops.
7. Add to Home Screen → sign in once → reopen: last station shown, not autoplaying.
