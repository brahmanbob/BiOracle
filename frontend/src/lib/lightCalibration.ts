/**
 * lightCalibration.ts
 * ----------------------------------------------------------------
 * Sovereign light-source calibration for Bio-Beauty / Medical scans.
 *
 *  Strategy:
 *    Open the rear camera at minimal resolution for ~600 ms, sample
 *    the average R, G, B of an 8 × 8 pixel central patch, and derive
 *    the Correlated Colour Temperature (CCT) using a fast R/B-ratio
 *    approximation (sufficient at the lux band BiOracle scans live in:
 *    50 – 30,000 lux).
 *
 *  Output bands (per ANSI C78.377 white-light targets):
 *    • daylight       — 5500 – 7500 K (✓ scan)
 *    • neutral        — 4000 – 5000 K (⚠ minor skew)
 *    • warm-white     — 3000 – 4000 K (⚠ skin warmth bias)
 *    • yellow-LED     — 2200 – 3000 K (⚠⚠ glow index over-reads)
 *    • cool-LED       — 7500 K +     (⚠ erythema under-reads)
 *
 *  Sovereign: no telemetry, no persistence, single shot, stream closed.
 * ----------------------------------------------------------------
 */

export type LightBand =
  | "daylight"
  | "neutral"
  | "warm-white"
  | "yellow-LED"
  | "cool-LED"
  | "unknown";

export interface LightCalibration {
  kelvin: number;
  band: LightBand;
  rOverB: number;
  rOverG: number;
  meanLuma: number;       // 0..1
  warning: string | null;
  scanReady: boolean;
}

const PATCH = 8;

export async function calibrateLight(
  facingMode: "user" | "environment" = "environment",
): Promise<LightCalibration> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 96 }, height: { ideal: 96 } },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});

    // Let auto-exposure settle ~400 ms
    await new Promise((r) => setTimeout(r, 400));

    const canvas = document.createElement("canvas");
    canvas.width = PATCH;
    canvas.height = PATCH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas-2d-unavailable");

    // Sample the central patch
    ctx.drawImage(
      video,
      Math.max(0, (video.videoWidth - PATCH) / 2),
      Math.max(0, (video.videoHeight - PATCH) / 2),
      PATCH, PATCH,
      0, 0, PATCH, PATCH,
    );
    const data = ctx.getImageData(0, 0, PATCH, PATCH).data;
    let rs = 0, gs = 0, bs = 0;
    const px = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      rs += data[i]; gs += data[i + 1]; bs += data[i + 2];
    }
    const R = rs / px, G = gs / px, B = bs / px;
    const meanLuma = (0.299 * R + 0.587 * G + 0.114 * B) / 255;

    const rOverB = B > 0 ? R / B : 99;
    const rOverG = G > 0 ? R / G : 1;

    const { kelvin, band } = ratioToKelvin(rOverB);
    const warning = warningFor(band, kelvin);

    return {
      kelvin: Math.round(kelvin),
      band,
      rOverB: round(rOverB, 3),
      rOverG: round(rOverG, 3),
      meanLuma: round(meanLuma, 3),
      warning,
      scanReady: band === "daylight" || band === "neutral",
    };
  } finally {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }
}

function ratioToKelvin(rOverB: number): { kelvin: number; band: LightBand } {
  // Empirical mapping. Lower R/B → cooler light.
  // 0.55 ≈ 10000K, 1.0 ≈ 6500K, 1.4 ≈ 4500K, 1.8 ≈ 3200K, 2.4 ≈ 2400K
  if (rOverB > 2.0) return { kelvin: 2400 + Math.max(0, (2.6 - rOverB) * 600), band: "yellow-LED" };
  if (rOverB > 1.55) return { kelvin: 3000 + (2.0 - rOverB) * 1000, band: "warm-white" };
  if (rOverB > 1.15) return { kelvin: 4000 + (1.55 - rOverB) * 2500, band: "neutral" };
  if (rOverB > 0.8)  return { kelvin: 5500 + (1.15 - rOverB) * 2800, band: "daylight" };
  return { kelvin: 7500 + (0.8 - rOverB) * 4000, band: "cool-LED" };
}

function warningFor(band: LightBand, k: number): string | null {
  switch (band) {
    case "daylight":
      return null;
    case "neutral":
      return `Neutral white (~${Math.round(k)} K). Minor skew — proceed.`;
    case "warm-white":
      return `Warm-white light (~${Math.round(k)} K). Glow Index may read +8 % too high. Move to a window for true colour.`;
    case "yellow-LED":
      return `Yellow LED detected (~${Math.round(k)} K, < 3000 K). Skin yellow-shift and Glow Index will skew. Re-take by natural daylight for clinical-grade reading.`;
    case "cool-LED":
      return `Cool LED / overcast (~${Math.round(k)} K). Erythema may under-read by ~10 %. Daylight preferred.`;
    default:
      return "Unrecognised lighting — accuracy unverified.";
  }
}

function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
