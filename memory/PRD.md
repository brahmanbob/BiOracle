# BiOracle — Sovereign Triage PWA

## Original Problem
Elite, sovereign bio-hacking + health-triage PWA for Samsung S21.  Uses Web APIs to simulate native sensor work:
- Camera + flash → PPG / blood / retinol / tongue / skin scans
- Microphone → stomach acoustic / pet acoustic / infant respiration
- Magnetometer → "Magnetic Field Mitigation" (NOT an RF meter — regulatory clarity in V14.2)
- Haptics, navigator.vibrate, AmbientLightSensor

UI: dark · gold · glassmorphic "Sovereign Ritual" aesthetic with profile-specific themes:
- Sovereign  · gold-on-obsidian
- Bio Cruise · carbon-fiber + neon volt
- Bio Beauty · liquid pearl + iridescent rose
- **Bio Pet · terracotta & cream  (V14.1)**
- **Bio Baby · lavender & white   (V14.1)**
- **Guardian · deep navy & bone white (V14.1)**

Backend: FastAPI + MongoDB ledger; PWA standalone with offline cache.

## Completed milestones (chronological)
- V1–V12: PPG, vascular age, EMF magnetometer, tongue/retinol image stubs, FastAPI ledger, PDF reporter.
- V13 Sovereign Ritual: Bento Bash, full-screen wizard (Retinol → Tongue → Blood → Banter), Universal Stealth.
- V14 Sovereign Lifestyle: Bio Cruise (Anabolic Window), Bio Beauty (Glow Index), profile theming.
- V14 Auto-Stealth Invention: static-motion + screen-on detector, suppresses radios, Ghost Silver ripple.
- **V14.1 Caregiver Empire (NEW)**:
  - Bio·Pet acoustic scan with species-specific bands (dog 200–700 Hz, cat 700–1500 Hz, sub-rumble 30–150 Hz for bloat).
  - Bio·Baby crib watch: respiration tracking, Absolute Stealth when phone-static + low-light.
  - Guardian Trusted-Link: stores one contact in localStorage, 5-second hold-to-send auto-PDF + Web Share / mailto / clipboard fallback.
  - Caregiver banter tone in remedyEngine — supportive, clear, non-alarmist.
- **V14.2 Calibration Layer (NEW)**:
  - `lightCalibration.ts` + `LightCalibrationGate.tsx`: 8×8 px central-patch RGB sample → CCT estimate (daylight / neutral / warm-white / yellow-LED / cool-LED) before Beauty + Medical scans.
  - 3-second noise-floor "Silent Check" in `usePetAcoustic` and `useStomachMic` — subtracts ambient floor from live readings.
  - Stealth scene relabelled "Magnetic Field Mitigation" with explicit "NOT an RF meter" disclosure and compliance footer.
- **V14.3 The Core · The Sieve · The Sentry (NEW)**:
  - `ocularVitals.ts` + `OcularPanel.tsx`: HR (measured) · BP (estimate, cuff-calibratable) · SpO₂ (indicative, red-only) — every value tagged with confidence tier; "No-BS" honesty line.
  - `banterSieve.ts` + `BanterSieve.tsx`: 5-question pre-filter (coffee, sleep, stress, hydration, last meal, meds, acute pain) → demotes / promotes urgency, gates supplement & doctor suggestions.
  - `remedyEngine.generateRemedy` now consumes `SieveContext` to filter out actions, demote/promote bands, and tag flags.
  - Dashboard `sentry-pulse` chip — visible "AUTO-STEALTH SENTRY · listening (n/3)" indicator, glows white when engaged.

## Architecture
```
/app/frontend/src/
├── App.tsx              # scene routing, profile state, auto-stealth orchestration
├── SovereignLogic.ts    # deterministic triage math
├── components/
│   ├── LightCalibrationGate.tsx     (V14.2)
│   ├── OcularPanel.tsx              (V14.3)
│   ├── Spectrogram.tsx · LiquidVialBattery.tsx · SignalCard.tsx
├── hardware/
│   ├── useAmbientLight.ts           (V14.1)
│   ├── usePetAcoustic.ts            (V14.1 + V14.2 noise floor)
│   ├── useRespiration.ts            (V14.1)
│   ├── usePPGScanner.ts · useStomachMic.ts (V14.2 noise floor) · useMagnetometer.ts
│   ├── useIntent.ts · useAutoStealth.ts · useNativeBridge.ts · useHaptics.ts
├── lib/
│   ├── lightCalibration.ts          (V14.2)
│   ├── ocularVitals.ts              (V14.3)
│   ├── banterSieve.ts               (V14.3)
│   ├── trustedLink.ts               (V14.1)
│   ├── remedyEngine.ts · pdfReport.ts · vascularAge.ts · skinAnalysis.ts
├── scenes/
│   ├── Dashboard.tsx · MedicalRitual.tsx · DigestionScene.tsx · EmergencyScene.tsx
│   ├── StealthScene.tsx · CruiseScene.tsx · BeautyScene.tsx · LiquidBatteryFullscreen.tsx
│   ├── PetScene.tsx · BabyScene.tsx · GuardianScene.tsx       (V14.1)
├── wizard/
│   ├── RetinolScan.tsx · TongueScan.tsx · BloodScan.tsx (V14.3 OcularPanel) · BanterCompute.tsx (V14.3 Sieve)
│   ├── BanterSieve.tsx                                         (V14.3)
└── styles/bioracle.css
```

## Key APIs (unchanged)
- `POST /api/triage/scan` – commits sensor payload, returns scanId
- `GET  /api/ledger/{scanId}` – pulls raw ledger for QR code

## Backlog / future
- P1: Trend dashboard reading historical scans from MongoDB (longitudinal lectin / EMF / asymmetry).
- P1: True pixel-perfect tongue/retinol analysis (currently deterministic heuristic).
- P2: Native APK via Capacitor + RadioSuppress plugin for full radio quiescence.
- P2: Push to Github → user-side via "Save to Github" UI (no autonomous push).

## Sovereign Tone (preserved)
Always the Guide — never a cold device. Banter tuned per profile, supportive caregiver voice for pet/baby/guardian. No fabricated numbers — every vital tagged measured / estimate / indicative.
