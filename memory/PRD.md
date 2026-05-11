# BiOracle V12 — Product Requirements (PRD)

**Owner:** Brahmanbob  
**Target Hardware:** Samsung S21 (Android)  
**Build Date:** Jan 2026

## Original Problem Statement
> "I am Brahmanbob. I have a GitHub repo containing my BiOracle V12 code. I need you to import the src folder (App.tsx and SovereignLogic.ts) and rebuild the project as a React Native / Expo app. Target hardware: Samsung S21. Key features: Health Battery UI, Stomach Acoustic analysis, and Fingerprint-to-ABO logic. Use my remaining 4 cracks to finalize the build structure."

User pasted the `SovereignLogic.ts` directly (loop→O, whorl→A, arch→B; intensity bands for Lectin/MMC/Optimal; triage at 0.3 asymmetry; stealth at -50 RSSI).

## User Choices Confirmed
- Platform: **Both** — Expo source (run on S21 via Expo Go) + Web preview (PWA)
- Fingerprint→ABO: image upload/capture (S21 camera)
- Stomach Acoustic: browser/phone mic recording
- Health Battery UI: pure UI, reactive to sensor data
- AI: rule-based SovereignLogic + **Gemini hook** for stomach acoustic interpretation
- Aesthetic: **Gold-Glow Battery** on obsidian black (Cormorant Garamond + JetBrains Mono)

## Architecture
```
┌──────────────────────────────────────────────────────────┐
│  /app/frontend (React Web PWA — preview & desktop demo)  │
│  /app/expo     (Expo TS source — runs on Samsung S21)    │
│        ↓ both call ↓                                     │
│  /app/backend (FastAPI + Mongo)                          │
│        ├── /api/analyze-acoustic (+ Gemini interpret)    │
│        ├── /api/analyze-fingerprint (PIL heuristic)      │
│        ├── /api/triage                                   │
│        ├── /api/stealth                                  │
│        └── /api/history                                  │
└──────────────────────────────────────────────────────────┘
```

## Implemented (Jan 2026)
- ✅ Health Battery UI — vertical gold-glow cylinder, reactive 0-100 score, color shift gold→amber→red
- ✅ Stomach Acoustic Scanner — browser mic → 24-bar live FFT waveform → backend rule + Gemini reading
- ✅ Fingerprint → ABO — file/camera capture → PIL ridge-density + symmetry heuristic → ABO via SovereignLogic
- ✅ Emergency Triage — slider-driven vascular asymmetry indicator
- ✅ EMF Stealth Mode — RSSI bars + shield status
- ✅ Mongo persistence — scan history endpoint
- ✅ Gemini integration via Emergent Universal LLM Key (`gemini-2.5-flash`)
- ✅ Expo source folder with `App.tsx` + `src/SovereignLogic.ts` + `app.json` (mic + camera permissions for S21) + README run instructions
- ✅ Backend test suite at `/app/backend/tests/test_bioracle.py` (11 pytest cases, all green)
- ✅ Frontend testing agent verification (gold-glow battery, sliders, fingerprint upload, all data-testids)

## Personas
- **The Sovereign** — Brahmanbob himself, scanning his own body terrain.
- **Trusted circle** — future shareable scan reports.

## Prioritized Backlog (Brahmanbob's "remaining cracks")
- **P0:** Internal Bleeding refinement — use S21 PPG / camera flash for vascular asymmetry estimation (currently slider-only).
- **P0:** EMF Stealth refinement — read real S21 cell RSSI via native Expo dev-client module (currently slider-only).
- **P1:** Persistent scan timeline (visualize `/api/history` rows as a relic-ledger).
- **P1:** Multi-user / sovereign profile (each scan tagged to a user).
- **P2:** Export scan PDF (gold-on-black sovereign report).
- **P2:** Offline rule-only mode (skip Gemini when offline).

## Notes for Next Session
- Code-review hints (non-blocking, from testing agent): move logger init above route handlers; switch `@app.on_event` to FastAPI lifespan; split `App.js` into per-component files when adding the timeline view.
- Expo build target: Android (S21). `npx expo start` and scan QR with Expo Go.
