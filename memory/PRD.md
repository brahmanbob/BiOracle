# BiOracle — Product Requirements

## Original problem statement
BiOracle (brahmanbob/BiOracle) — sovereign biological-triage app for Samsung S21.

## Crack roadmap
- **Crack #1 — Shell** ✅ — SovereignLogic + Obsidian/Gold Health Battery + Triage Dashboard + ledger.
- **Crack #2 — Sensor wiring** ✅ — Live PPG / mic / magnetometer with Synthetic Interference badge.
- **Crack #3 — Golden Relic (Unlimited)** ✅ (2026-05-11) — Neumorphic Glassmorphism, 3D Liquid Vial slosh, Haptic Engine, Spectrogram heatmap, APG Vascular Age, Gold-on-Obsidian PDF + QR.

## Architecture
- **Frontend**: React 19 + TypeScript (CRA + CRACO). Canvas-based Liquid Vial + Spectrogram. jsPDF + qrcode for clinical handoff. Theme `bioracle.css` (Obsidian / Gold / Neumorphic glass; Cormorant Garamond + JetBrains Mono).
- **Backend**: FastAPI + Motor (MongoDB) — sovereign ledger with arbitrary `raw` sensor traces.

## Core files
- `frontend/src/SovereignLogic.ts` — `fingerprintToABO`, `stomachAcousticAnalysis`, `emergencyTriage`.
- `frontend/src/hardware/usePPGScanner.ts` — env-cam + torch + canvas red-channel → HR / HRV / amplitude → asymmetry. Emits per-beat `onBeat()` for haptic thump and `lastBeatTs` for caustic flash.
- `frontend/src/hardware/useStomachMic.ts` — AnalyserNode → time-domain feeds `stomachAcousticAnalysis`, frequency-domain → sub-50 Hz lectin signature. Exposes the live AnalyserNode for the Spectrogram.
- `frontend/src/hardware/useMagnetometer.ts` — Generic Sensor `Magnetometer({frequency:10})` → µT magnitude; µT > 65 lights the Synthetic Interference badge.
- `frontend/src/hardware/useHaptics.ts` — wraps `navigator.vibrate` with S21-tuned patterns: `softTap` (20ms), `thump` (28ms, per beat), `heavyClick` ([90,35,140] for Stealth), `criticalBuzz`, `sovereignChime`.
- `frontend/src/lib/vascularAge.ts` — Takazawa APG analysis: second derivative of PPG → a/b/c/d/e landmark detection → Aging Index `(b-c-d-e)/a` → Vascular Age (18..95 y).
- `frontend/src/lib/pdfReport.ts` — A5 portrait Gold-on-Obsidian jsPDF: header sigil, verdict block with flags, 10-row sensor telemetry table, QR (gold-on-obsidian) encoding `${BACKEND_URL}/api/ledger/${scanId}`.
- `frontend/src/components/LiquidVialBattery.tsx` — Canvas rAF loop: dual sine-wave meniscus, slosh physics (tilt momentum + damping), gold gradient + caustic spotlight pulsing on each beat, bubbles, gold rim highlights, vial cap, EMF lattice + red rim flash on synthetic interference.
- `frontend/src/components/Spectrogram.tsx` — rolling FFT-magnitude heatmap. Color ramp obsidian-violet → magenta → amber → gold. Sub-50 Hz Lectin band highlighted with a magenta rail. Scrolls left 1px/frame.
- `frontend/src/components/TriageDashboard.tsx` — 4 glass cards: Vascular Triage (sparkline + APG row), Lectin · Stomach (live spectrogram), EMF Stealth, Acoustic State.
- `frontend/src/App.tsx` — composes all hooks + haptics + critical-state one-shot alarm + Stealth toggle + Print PDF for Medic flow.
- `frontend/app.json` — Expo manifest with CAMERA / FLASHLIGHT / RECORD_AUDIO / MAGNETOMETER permissions for future native build.

## Sensor → SovereignLogic mapping
| Input               | Source                                                  | Trigger                              |
|---------------------|---------------------------------------------------------|--------------------------------------|
| `lectin`            | `useStomachMic.lectinSignature` (0.7·subSonic + 0.3·events) | ≥ 0.75 → CRITICAL              |
| `vascularAsymmetry` | `usePPGScanner.asymmetry` = 0.6·HRV_norm + 0.4·lowSNR    | ≥ 0.70 → CRITICAL                  |
| `emf`               | `useMagnetometer.emfIndex` = (µT-30)/120                 | µT > 65 → synthetic-interference   |
| `heartRate`         | `usePPGScanner.heartRate`                                | drives vial slosh + haptic thump   |
| `vascularAge`       | `vascularAge.ts` Takazawa APG on raw PPG                 | clinical readout, not a triage gate |

## Haptic vocabulary
- Stealth toggle → `heavyClick` `[90, 35, 140]` (heavy mechanical click)
- Each PPG beat → `thump` 28 ms
- Critical verdict (one-shot) → `criticalBuzz` `[180,70,180,70,320]`
- Sovereign-override → `sovereignChime` `[240,60,60,60,240,60,60,60,520]`
- Generic taps → `softTap` 20 ms

## PDF report
- A5 portrait Gold-on-Obsidian (fits a clinician's pocket).
- Sigil + verdict + score + directive + colour-coded flag pills.
- 10-row sensor telemetry table (HR / HRV / amp / vascular age / asymmetry / lectin sig / sub-50 Hz / acoustic state / EMF / ABO).
- Gold-framed QR encoding `${BACKEND_URL}/api/ledger/${scanId}`.
- Auto-commits a ledger entry if no scan id exists yet, then downloads `bioracle-{id8}-{level}.pdf`.
- Triggered by the **Print PDF for Medic** button which gains a `critical-pulse` red glow when `verdict.critical`.

## Verified (2026-05-11)
- Liquid Vial canvas animates (gold slosh + caustics) — visual confirmed.
- Neumorphic glass buttons render with backdrop blur + dual inset shadows.
- Stealth Mode dims layout + flips toggle indicator red.
- Backend round-trips enriched payload (raw.ppg, raw.apg, raw.mag, raw.mic) at 200; ledger GET returns vascularAge 58y, µT 81.2, etc.
- TypeScript compile clean (No issues found).

## Field-test ritual (S21)
1. Open preview URL in **standalone Chrome tab** (not iframe).
2. Tap **Run Full Scan**, grant camera + mic + magnetometer perms.
3. Place fingertip over rear lens (torch will engage) → 12 s scan computes HR, HRV, Vascular Age (APG), asymmetry.
4. Hold device against abdomen 15 s — spectrogram lights up sub-50 Hz Lectin band in magenta if inflamed.
5. Walk past Wi-Fi router / hold phone-to-head — µT > 65 triggers SYNTHETIC INTERFERENCE badge.
6. Tap **Print PDF for Medic** → ledger commit → A5 PDF downloads with QR.
7. Toggle **STEALTH** when you need a heavy mechanical haptic click + dimmed UI.

## Next / Backlog
- 5-scan rolling local baseline so triage flags personal deviation, not absolute thresholds.
- Native Expo build to access raw Bluetooth/IR sensors beyond browser scope.
- Optional: signed/encrypted ledger entries so the QR PDF proves provenance.
