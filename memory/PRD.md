# BiOracle — Sovereign Ritual V13

## Original problem statement
BiOracle (brahmanbob/BiOracle) — sovereign biological-triage app for Samsung S21.

## Crack roadmap
- Crack #1 Shell · #2 Sensors · #3 Golden Relic — superseded.
- **V13 Sovereign Ritual** ✅ (2026-05-11) — full UI rewrite to Bento + Immersion + Wizard + Banter + Swipe Vial + Contextual Stealth.

## V13 Architecture
- **Scene state machine** in `App.tsx` (`useState<Scene>`) — no router lib. Scenes: `dashboard` · `medical` · `digestion` · `emergency` · `stealth` · `vial`.
- **Bento Dashboard** (`scenes/Dashboard.tsx`) — 4 tiles only, exact accents:
  - Medical · Sky Blue `#6dc4dd`
  - Digestion · Amber `#f5a623`
  - Emergency · Blood Red `#ff5b50` (pulsing)
  - Stealth · Silver `#cfcfd9`
- **Full-screen immersion** — tapping a tile replaces the dashboard entirely; animated fade+blur entry.
- **Swipe-down anywhere on dashboard** → `LiquidBatteryFullscreen` overlay (zoomed 1.4× vial); swipe-up or tap to close. (`hardware/useSwipeGesture.ts`)

## Ritual Wizard (Medical scene)
Sequential pipeline with dot-stepper:
1. `wizard/RetinolScan.tsx` — front camera → `analyseSclera()` → yellowness/redness/dryness → indicator `{stable|watch|irritated|jaundiced}`.
2. `wizard/TongueScan.tsx` — front camera → `analyseTongue()` → hue/coating/redness → TCM-ish state `{healthy|qi-deficient|heat|stasis|damp-heat}`.
3. `wizard/BloodScan.tsx` — rear camera + torch PPG (12s) → HR, HRV, asymmetry, **APG vascular age**.
4. `wizard/BanterCompute.tsx` — conversational Oracle persona, accepts free text symptoms, runs `generateRemedy()` → **Remedy Card** with 3 prioritized actions + today's ritual + Print PDF for Medic.

## Remedy Engine
`lib/remedyEngine.ts` — deterministic, sovereign (no LLM, no network call). Fuses all 3 scans + free-text banter keyword detection (`fatigue/pain/headache/digestion/sleep/anxiety/bleeding/fever/vision`). Output: `{banter, topConcern, band: stable|watch|urgent, actions[], ritual, echoedSymptoms, flags}`. Bands drive PDF visibility (Print PDF for Medic appears only when band ≠ stable).

## Contextual Stealth
`hardware/useIntent.ts` fuses:
- `dwell` — fraction of last 30s with no scroll/touch
- `motionStability` — DeviceMotion accel variance inverted
- `magStability` — µT variance inverted
- `visibility` — `document.visibilityState`

→ `intent` 0..1 score. `stealthEngaged = (µT > 65) AND (intent > 0.6)` — proactively flags EMF interference *only when the carrier is focused* (real attack vector, not ambient noise). Surfaces as red-pulsing app filter + Stealth-scene alert banner.

## Image analysis (`lib/imageAnalysis.ts`)
- Sclera: central horizontal strip mean RGB, yellow/red votes, luminance variance for dryness proxy.
- Tongue: central square mean RGB, saturation, high-luminance low-saturation share → coating; redness vote.

## Preserved from previous cracks
- `SovereignLogic.ts` — `fingerprintToABO`, `stomachAcousticAnalysis`, `emergencyTriage`
- `hardware/usePPGScanner.ts` · `useStomachMic.ts` · `useMagnetometer.ts` · `useHaptics.ts`
- `lib/vascularAge.ts` (Takazawa APG)
- `lib/pdfReport.ts` (Gold-on-Obsidian A5 PDF + QR ledger)
- `components/LiquidVialBattery.tsx` (used inside `scenes/LiquidBatteryFullscreen`)
- `components/Spectrogram.tsx` (used inside Digestion scene)
- Backend `/api/triage/scan` + `/api/ledger/{id}` unchanged.
- PWA `manifest.json` + `sw.js` + procedural gold-sigil icons unchanged.

## Verified (2026-05-11)
- All 6 testIDs for bento tiles present
- Dashboard genuinely vanishes on tile open (`dashboard while in immersion: 0`)
- Medical immersion lands on `step-retinol` with full stepper visible
- Stealth scene renders 6 gauges + graceful "Magnetometer unavailable" fallback
- TypeScript: No issues found · webpack compiled successfully

## Field-test ritual
1. Open URL in **standalone Chrome on S21** (not iframe).
2. Dashboard appears with 4 tiles.
3. Swipe down → full-screen Liquid Vial.
4. Tap **Medical** → Retinol → Tongue → Blood → Banter → Remedy Card → Print PDF for Medic if urgent/watch band.
5. Tap **Digestion** → mic + spectrogram + lectin signature.
6. Tap **Emergency** → PPG triage + vascular age + bleeding-suspect flag + PDF.
7. Tap **Stealth** → watch EMF × Intent fusion; spike during focus = red alert banner.

## Backlog
- Wire `localStorage` rolling baseline (5 last scans) for per-user deviation triage.
- Optional Ed25519-signed ledger entries (provenance/tamper for medic).
- Native Capacitor/Expo build via PWABuilder TWA — `app.json` permissions already aligned.
