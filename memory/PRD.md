# BiOracle — Product Requirements

## Original problem statement
BiOracle (brahmanbob/BiOracle) — sovereign biological-triage app for Samsung S21.
Headline features (full roadmap):
1. **Vascular Asymmetry (Internal Bleeding)** — Replace slider with rear-cam + flash PPG. Light-absorption variance → asymmetry score → `emergencyTriage` in `SovereignLogic.ts`.
2. **Clinical Leverage (PDF Report)** — Gold-on-Obsidian one-page PDF with QR linking to raw sensor ledger; auto-generated on Critical signals.
3. **EMF Stealth Sensor** — Wire magnetometer; show "Synthetic Interference" warning on Health Battery.
4. **UI Polish** — Gold-Glow Battery pulse frequency matches PPG-detected heart rate.

## Crack roadmap (user-authored phasing)
- **Crack #1 — Shell (THIS PASS, DONE 2026-05-11)**: SovereignLogic + Obsidian/Gold Health Battery + Triage Dashboard + app.json with expo deps + backend ledger foundation.
- **Crack #2 — Sensor wiring**: PPG (expo-camera + flash), stomach mic (expo-av), magnetometer (expo-sensors).
- **Crack #3 — Clinical Leverage PDF**: Gold-on-Obsidian jsPDF report + QR code → `/api/ledger/{id}`.

## Architecture
- **Frontend**: React 19 + TypeScript (CRA + CRACO), Tailwind disabled in favour of `bioracle.css` (Obsidian/Gold theme, Cormorant Garamond + JetBrains Mono).
- **Backend**: FastAPI + Motor (MongoDB) — sovereign ledger.
- **Mobile-native targets** declared in `app.json` for future Expo build (Camera, AV, Sensors).

## Core files
- `frontend/src/SovereignLogic.ts` — pure functions: `fingerprintToABO`, `stomachAcousticAnalysis`, `emergencyTriage`.
- `frontend/src/App.tsx` — root, wires Health Battery + Triage Dashboard.
- `frontend/src/components/HealthBattery.tsx` — SVG obsidian-shell + gold-fill + heart-rate-locked pulse ring (60000/bpm ms).
- `frontend/src/components/TriageDashboard.tsx` — 4 signal cards (Lectin / Vascular / EMF / Acoustic).
- `frontend/src/components/SignalCard.tsx` — reusable card with severity bar.
- `frontend/src/styles/bioracle.css` — full Obsidian/Gold theme + heartbeat keyframes.
- `frontend/app.json` — Expo manifest declaring `expo-camera`, `expo-av`, `expo-sensors` for Crack #2.
- `backend/server.py` — `POST /api/triage/scan`, `GET /api/ledger/{id}`, `GET /api/triage/scan`.

## API surface
| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/` | Service handshake |
| POST   | `/api/triage/scan` | Persist sensor data + verdict; returns `{id, ledger_url, critical, level}` |
| GET    | `/api/triage/scan` | List recent scans |
| GET    | `/api/ledger/{scan_id}` | Public ledger (QR target on the medic-handoff PDF) |

## Triage logic (SovereignLogic.emergencyTriage)
- `lectin ≥ 0.75` → Critical (lectin-spike)
- `vascular ≥ 0.70` → Critical (internal-bleeding-suspect)
- `emf ≥ 0.65` → flag `synthetic-interference`
- Both critical signals + high EMF → **sovereign-override** (medic-handoff warranted)
- Acoustic state `lectin-irritation` amplifies lectin by +0.15
- AB blood group amplifies lectin by +0.08

## What's implemented (Crack #1)
- [x] `SovereignLogic.ts` with fingerprint→ABO, stomach acoustic, emergency triage
- [x] Obsidian & Gold Health Battery (SVG, heart-rate-locked pulse, severity colouring)
- [x] Digital Triage Dashboard (4 signal cards, sliders as Crack #2 placeholders)
- [x] Backend ledger (POST scan / GET ledger / 404 on missing)
- [x] Mock scan ramps HR + scanIntensity so pulse-frequency-lock is visibly demonstrated
- [x] `app.json` declaring expo-camera / expo-av / expo-sensors permissions for future native build
- [x] Backend ↔ frontend integration smoke-tested (ledger id surfaced in UI)

## Next Action Items (Crack #2)
- Wire `expo-camera` (or Web `getUserMedia` + ImageCapture torch) for PPG scan → derive HR + vascular asymmetry
- Wire `expo-av` (or `MediaRecorder`) for stomach acoustic
- Wire `expo-sensors` Magnetometer (or `Magnetometer` Web API) for EMF
- Replace vascular slider with `PPGScanner` component pushing into `setVascular`

## Backlog (Crack #3)
- `jspdf` + `qrcode` Gold-on-Obsidian one-page report
- Auto-trigger PDF on any `critical` verdict
- QR encodes absolute `/api/ledger/{id}` URL
