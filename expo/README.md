# BiOracle V12 — Expo Build (Samsung S21)

This folder contains the **React Native / Expo** source for BiOracle V12. It is parallel to the web preview at `/app/frontend` and shares the same backend at `BACKEND_URL`.

## What's inside
```
expo/
├── App.tsx                     # Root component (HealthBattery + AcousticScanner + FingerprintABO)
├── src/SovereignLogic.ts       # Pure ABO / acoustic / triage / stealth rule-based logic
├── app.json                    # Expo manifest (mic + camera permissions for S21)
├── package.json                # expo-av, expo-image-picker
└── tsconfig.json
```

## Run it on your Samsung S21
1. Install Node 18+ and the Expo Go app from Play Store on your S21.
2. On your laptop, in this folder:
   ```bash
   cd /app/expo
   npm install        # or: yarn
   npx expo start
   ```
3. Scan the QR code from your S21's Expo Go app. The app loads natively.
4. Grant **Microphone** (stomach acoustics) and **Camera** (fingerprint) when prompted.

## Backend
`App.tsx` calls the same FastAPI backend as the web preview:
```
const BACKEND_URL = 'https://fingerprint-abo.preview.emergentagent.com';
```
Endpoints used:
- `POST /api/analyze-acoustic`
- `POST /api/analyze-fingerprint`
- `POST /api/triage`
- `POST /api/stealth`

## Hardware feature mapping
| Feature                  | S21 hardware used                 | Implementation                                |
|--------------------------|-----------------------------------|-----------------------------------------------|
| Health Battery UI        | screen                            | Pure RN view, gold-glow shadow, reactive fill |
| Stomach Acoustic         | mic (`expo-av`)                   | Records audio, sends intensity to backend     |
| Fingerprint → ABO        | rear camera (`expo-image-picker`) | Captures image, sends base64 to backend       |

## Future cracks (deferred)
- **Internal Bleeding** sensor — uses S21 PPG / camera for vascular asymmetry estimation.
- **EMF Stealth** sensor — reads S21 cell RSSI via native module (requires custom dev client).
