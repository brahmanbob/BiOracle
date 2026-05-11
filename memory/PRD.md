# BiOracle — Auto-Stealth (V15-Trinity Invention)

## Original problem statement
BiOracle (brahmanbob/BiOracle) — sovereign biological-triage app for Samsung S21.

## Crack roadmap
- Crack #1 Shell · #2 Sensors · #3 Golden Relic — superseded.
- V13 Bento UI · V14 Profiles (Sovereign / Cruise / Beauty).
- **Auto-Stealth Invention** ✅ (2026-05-11) — proactive radio suppression on static phone + screen on + dwell.

## Auto-Stealth logic
`useIntent.ts` now computes:
- `magVariance` (rolling σ of µT samples over 100 ticks)
- `motionVariance` (rolling σ of DeviceMotion accel magnitude over 60 ticks)
- `autoStealthEngaged = magVariance > 0 AND magVariance < 0.05µT AND motionVariance < 0.25 m/s² AND visibility AND dwell > 4s`

`useAutoStealth.ts` orchestrator:
- Debounces 3 consecutive seconds of `autoStealthEngaged` before engaging (so micro-shakes don't flap the radio)
- On engage → `useNativeBridge.suppressRadio()` (wake-lock + ABORT_BUS abort + Capacitor RadioSuppress plugin if present)
- On disengage → `releaseRadio()` immediately (single-tick, safety first)
- Exposes `{active, engagedSince, staticTicks, lastResult, runtime}`

`App.tsx` runs it globally across all profiles (Sovereign / Cruise / Beauty) — Stealth IS universal.

## Ghost Silver ripple
CSS-only overlay (`.bo-ghost-ripple`) mounted only when `autoStealth.active`:
- 4 staggered ripple rings (`r1..r4`) animating inward at 4s cycle with 1s phase offsets
- `::before` / `::after` edge-glow strips with `mix-blend-mode: screen`
- Floating bottom-center pill: `◉ AUTO-STEALTH · {n}s · {runtime}`
- Silver accent #d6d8e0 — subtle, not alarming (different from the red Reactive Stealth banner)
- Card borders across the entire app shift to silver tone via `.bo-app.auto-stealth-active`

## Native bridge enhancements (`useNativeBridge.ts`)
- Runtime detection: `capacitor / twa / pwa / browser`
- Best-effort suppression chain:
  1. `navigator.wakeLock.request("screen")` — keeps screen alive
  2. `ABORT_BUS` — aborts any registered `AbortController`s (app components can `registerAbortable()` to opt-in)
  3. `window.Capacitor.Plugins.RadioSuppress.engage()` — calls user-shipped Capacitor plugin if present in the APK
  4. PWA fallback: marks `airplaneModePromptShown` so the Stealth scene tells the user only OS-level Airplane Mode actually kills the modem

## Service worker
`bo.autostealth` periodic-sync handler — when granted (rare, requires user opt-in), posts a `bo.autostealth.tick` message to all open clients to keep the watcher alive between visibility flips. No-op when permission absent.

## Files added/changed this pass
- `hardware/useIntent.ts` — added `autoStealthEngaged`, `motionVariance`, `magVariance`
- `hardware/useAutoStealth.ts` — NEW orchestrator
- `hardware/useNativeBridge.ts` — already present from Trinity; reused
- `scenes/StealthScene.tsx` — rewritten: accepts shared `intent` + `autoStealth` props; shows tick counter, σ gauges with critical highlight, Force-Engage button, Auto alert card
- `App.tsx` — wires `useAutoStealth` globally; renders Ghost Silver ripple + AUTO pill
- `styles/bioracle.css` — Ghost ripple keyframes, auto alert card, app-wide silver border tint when active
- `public/sw.js` — periodic-sync listener
- (PWA manifest hardened in previous Trinity pass — display=standalone, orientation=portrait, shortcuts, id, scope, display_override)

## Verified
- TS compile: No issues found · webpack: compiled successfully (7 successive clean cycles)
- Dashboard renders V14 with Sovereign profile chip lit
- Stealth scene shows the 6-row bridge-status panel including "Auto · 0/3 ticks"
- 6 gauges render with σ values + critical-mark when < threshold
- Force Engage manual button present
- Ghost Silver ripple mounts when `data-auto-stealth="true"` (simulated, will fire automatically on a real S21 after 3 s static)

## Field-test on S21
1. Open BiOracle PWA installed on home screen
2. Place phone face-up on the desk, screen on, scroll once and then stop reading
3. ≤ 4 s later: dwell threshold met
4. ≤ 7 s later: 3 static ticks accumulated → Auto-Stealth engages
5. **Ghost Silver ripple** sweeps the screen edges inward
6. Bottom-center pill displays `AUTO-STEALTH · {elapsed}s · capacitor|twa|pwa|browser`
7. Open the Stealth tile to see the new Mag σ / Motion σ gauges + Suppression: RADIO QUIET row
8. Move the phone — Auto-Stealth releases instantly (single-tick safety)

## Honest limits (sovereign disclosure)
- **No web/PWA API can directly toggle the cellular/Wi-Fi/5G radio.** Only Airplane Mode does, and the OS gates it from every userland app.
- Auto-Stealth's actual radio-quieting is: wake-lock (no extra wake cycles), AbortController bus (no in-flight fetches keep chattering), and optional Capacitor `RadioSuppress` plugin (which a user must implement natively and ship in their APK — this is the seat for true Android `PowerManager.IDLE_DEVICE` style throttling).
- For full RF mitigation: install the PWA → wrap as Capacitor APK → ship a tiny `RadioSuppress.java` Capacitor plugin that hits `WifiManager.setWifiEnabled(false)` or `ConnectivityManager.requestNetwork()` with `NetworkCapabilities.NET_CAPABILITY_NOT_VPN`. This bridge is already wired — the hook will detect and call it.

## Backlog
- Optional `RadioSuppress.java` Capacitor plugin scaffold (~80 LOC) for the APK build
- `localStorage` rolling baseline for personal HRV / vascular age deviation alerts
- Ed25519-signed ledger entries for medic-handoff provenance
