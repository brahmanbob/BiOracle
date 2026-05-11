# BiOracle — Product Requirements

## Original problem statement
BiOracle (brahmanbob/BiOracle) — sovereign biological-triage app for Samsung S21.

## Crack roadmap
- **Crack #1 — Shell** ✅ (2026-05-11) — `SovereignLogic.ts`, Obsidian/Gold Health Battery, Triage Dashboard, backend ledger.
- **Crack #2 — Sensor wiring** ✅ (2026-05-11) — Live PPG (camera+torch+canvas), live mic (AnalyserNode), live magnetometer (Generic Sensor API), Synthetic Interference badge, PPG-amplitude flicker on battery glow.
- **Crack #3 — Clinical Leverage PDF** ⏳ Gold-on-Obsidian one-page PDF + QR → `/api/ledger/{id}`.

## Architecture
- **Frontend**: React 19 + TypeScript (CRA + CRACO). Theme `bioracle.css` (Obsidian/Gold; Cormorant Garamond + JetBrains Mono).
- **Backend**: FastAPI + Motor (MongoDB) — sovereign ledger.
- **Native target** declared in `app.json` (Expo) — `expo-camera`, `expo-av`, `expo-sensors`; web implementation uses the equivalent W3C APIs that already ship in S21 Chrome.

## Core files
- `frontend/src/SovereignLogic.ts` — `fingerprintToABO`, `stomachAcousticAnalysis`, `emergencyTriage`.
- `frontend/src/hardware/usePPGScanner.ts` — `getUserMedia` env-cam + `applyConstraints({advanced:[{torch:true}]})` + canvas red-channel sampling → HR (peak detection) + HRV (SDNN) + amplitude → asymmetry score (HRV+lowSNR fusion).
- `frontend/src/hardware/useStomachMic.ts` — `AudioContext` + `AnalyserNode` → time-domain feeds `stomachAcousticAnalysis`, frequency-domain computes sub-50Hz energy ratio + `lectinSignature`.
- `frontend/src/hardware/useMagnetometer.ts` — `new Magnetometer({frequency:10})` → µT magnitude, baseline (median), spike count, syntheticInterference when µT > 65.
- `frontend/src/components/HealthBattery.tsx` — SVG vessel; pulse duration = `60000/heartRate`; drop-shadow blur modulated by live PPG amplitude (real-time flicker); **SYNTHETIC INTERFERENCE** badge top-right when mag > 65 µT.
- `frontend/src/components/TriageDashboard.tsx` — 4 sensor cards with start/stop buttons, sparkline for PPG live signal, live readouts.
- `frontend/src/App.tsx` — composes all hooks, exposes Run Full Scan / Stop All / Commit to Ledger.
- `frontend/app.json` — Expo manifest with permissions (CAMERA, FLASHLIGHT, RECORD_AUDIO, MAGNETOMETER).
- `backend/server.py` — `/api/triage/scan` (POST + GET list), `/api/ledger/{id}` (GET, 404 if missing). Now accepts arbitrary `raw` object for sensor traces.

## Sensor → SovereignLogic mapping
| Input         | Source                                     | Triage threshold              |
|---------------|--------------------------------------------|-------------------------------|
| `lectin`      | `useStomachMic.lectinSignature` (sub-50Hz × events) | ≥ 0.75 → CRITICAL    |
| `vascularAsymmetry` | `usePPGScanner.asymmetry` = 0.6·HRV_norm + 0.4·lowSNR | ≥ 0.70 → CRITICAL |
| `emf`         | `useMagnetometer.emfIndex` = (µT-30)/120   | µT > 65 → synthetic-interference flag |
| `heartRate`   | `usePPGScanner.heartRate`                  | drives battery pulse + U-shaped HR risk |

## Verified (2026-05-11)
- Sliders → SOVEREIGN OVERRIDE escalation
- Mock scan → battery pulse retunes to HR
- Backend round-trip with enriched raw payload (PPG/mag/mic)
- Magnetometer graceful fallback when API unavailable

## Next (Crack #3)
- `yarn add jspdf qrcode`
- `lib/pdfReport.ts` — Gold-on-Obsidian one-page jsPDF renderer
- Auto-show "Print PDF for Medic" button on any `verdict.critical === true`
- QR encodes `${REACT_APP_BACKEND_URL}/api/ledger/${id}`
