/**
 * SovereignLogic.ts
 * ------------------------------------------------------------
 * Core sovereign decision engine for BiOracle.
 * Pure functions only — no React, no DOM, no side effects.
 *
 * Modules:
 *   1. Fingerprint → ABO blood type estimation
 *   2. Stomach Acoustic Analysis (audio → digestive signal)
 *   3. Emergency Triage (fuses Lectin + Vascular + EMF + acoustic)
 *
 * Hardware bindings (camera/PPG, mic, magnetometer) live in
 * separate hooks under src/hardware/. This file stays sovereign.
 * ------------------------------------------------------------
 */

// ============================================================
// TYPES
// ============================================================

export type BloodGroup = "O" | "A" | "B" | "AB";
export type RhFactor = "+" | "-";

export interface FingerprintRidgeData {
  /** Mean ridge density per mm² across the five distal phalanges */
  ridgeDensity: number;
  /** 0..1 — fraction of whorl-pattern fingers (0..5) / 5 */
  whorlRatio: number;
  /** 0..1 — fraction of loop-pattern fingers / 5 */
  loopRatio: number;
  /** 0..1 — fraction of arch-pattern fingers / 5 */
  archRatio: number;
  /** Optional: mean ridge break count (minutiae density signal) */
  minutiaeIndex?: number;
}

export interface ABOEstimate {
  group: BloodGroup;
  rh: RhFactor;
  confidence: number; // 0..1
  rationale: string;
}

export interface AcousticSample {
  /** Sample rate Hz */
  sampleRate: number;
  /** PCM samples normalised to [-1, 1] */
  samples: Float32Array | number[];
  /** Optional duration override (s) */
  durationSec?: number;
}

export type DigestiveState =
  | "silent"
  | "normal-peristalsis"
  | "hyperactive"
  | "obstruction-suspect"
  | "lectin-irritation";

export interface StomachAcousticSignal {
  state: DigestiveState;
  /** Borborygmi events per minute */
  bpm: number;
  /** Mean spectral centroid (Hz) — low = fluid, high = gas */
  spectralCentroid: number;
  /** 0..1 — irritation index (high freq + irregular intervals) */
  irritationIndex: number;
  rationale: string;
}

export type TriageLevel =
  | "stable"
  | "monitor"
  | "elevated"
  | "critical"
  | "sovereign-override";

export interface TriageInput {
  /** 0..1 lectin spike intensity (gut/blood reactivity) */
  lectin: number;
  /** 0..1 vascular asymmetry score (PPG light-absorption variance) */
  vascularAsymmetry: number;
  /** 0..1 EMF / synthetic-interference index (magnetometer + 5G proximity) */
  emf: number;
  /** Optional acoustic signal */
  acoustic?: StomachAcousticSignal;
  /** Heart rate from PPG (bpm), if available */
  heartRate?: number;
  /** Estimated blood group (used for lectin cross-reference) */
  blood?: ABOEstimate;
}

export interface TriageVerdict {
  level: TriageLevel;
  score: number; // 0..100
  flags: string[];
  /** True iff a Critical signal was detected (Lectin spike or Internal Bleeding). */
  critical: boolean;
  /** Human-readable directive for the medic / sovereign carrier. */
  directive: string;
  timestamp: string; // ISO
}

// ============================================================
// 1. FINGERPRINT → ABO
// ============================================================

/**
 * Heuristic mapping based on Dermatoglyphics-ABO correlation studies.
 * NOT a clinical diagnostic — a sovereign first-pass estimator.
 *
 *  - High whorl ratio + high ridge density → B / AB
 *  - High loop ratio                       → O / A
 *  - High arch ratio + low minutiae        → A
 *  - Balanced patterns                     → O (most common)
 */
export function fingerprintToABO(data: FingerprintRidgeData): ABOEstimate {
  const { ridgeDensity, whorlRatio, loopRatio, archRatio } = data;

  // Normalise ridge density (typical adult: 9–16 ridges/mm²)
  const rd = clamp01((ridgeDensity - 9) / 7);

  // Group scoring
  const score = {
    O: loopRatio * 0.55 + (1 - rd) * 0.35 + (1 - whorlRatio) * 0.1,
    A: archRatio * 0.5 + loopRatio * 0.3 + (1 - whorlRatio) * 0.2,
    B: whorlRatio * 0.55 + rd * 0.35 + (1 - archRatio) * 0.1,
    AB: whorlRatio * 0.45 + rd * 0.45 + archRatio * 0.1,
  };

  const group = (Object.keys(score) as BloodGroup[]).reduce((a, b) =>
    score[a] >= score[b] ? a : b,
  );

  const sorted = Object.values(score).sort((a, b) => b - a);
  const confidence = clamp01(sorted[0] - sorted[1] + 0.45);

  // Rh estimation: high minutiae density correlates weakly with Rh-
  const rh: RhFactor = (data.minutiaeIndex ?? 0) > 0.72 ? "-" : "+";

  return {
    group,
    rh,
    confidence,
    rationale:
      `Dermatoglyphic vector → whorl=${pct(whorlRatio)}, loop=${pct(
        loopRatio,
      )}, arch=${pct(archRatio)}, ridge=${ridgeDensity.toFixed(
        1,
      )}/mm². Sovereign estimate: ${group}${rh}.`,
  };
}

// ============================================================
// 2. STOMACH ACOUSTIC ANALYSIS
// ============================================================

/**
 * Lightweight time-domain + crude spectral analysis of intestinal sounds.
 * Real DSP (FFT, bowel-sound classifier) lands in Crack #2 with expo-av.
 */
export function stomachAcousticAnalysis(
  sample: AcousticSample,
): StomachAcousticSignal {
  const samples =
    sample.samples instanceof Float32Array
      ? sample.samples
      : Float32Array.from(sample.samples);
  const sr = sample.sampleRate;
  const dur = sample.durationSec ?? samples.length / sr;

  if (samples.length === 0 || dur <= 0) {
    return {
      state: "silent",
      bpm: 0,
      spectralCentroid: 0,
      irritationIndex: 0,
      rationale: "No acoustic signal received.",
    };
  }

  // RMS energy
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const rms = Math.sqrt(sumSq / samples.length);

  // Zero-crossing rate → proxy for spectral centroid
  let zc = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0) !== (samples[i] >= 0)) zc++;
  }
  const zcr = zc / samples.length;
  const spectralCentroid = (zcr * sr) / 2;

  // Borborygmi event detection: peaks above 2.5× RMS
  const threshold = rms * 2.5;
  let events = 0;
  let above = false;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > threshold && !above) {
      events++;
      above = true;
    } else if (v < threshold * 0.6) {
      above = false;
    }
  }
  const bpm = (events / dur) * 60;

  // Irritation: high freq + many events
  const irritationIndex = clamp01(
    (spectralCentroid / 800) * 0.6 + (bpm / 30) * 0.4,
  );

  let state: DigestiveState;
  if (rms < 0.005) state = "silent";
  else if (bpm > 25 && spectralCentroid > 500) state = "lectin-irritation";
  else if (bpm > 18) state = "hyperactive";
  else if (rms > 0.04 && bpm < 4) state = "obstruction-suspect";
  else state = "normal-peristalsis";

  return {
    state,
    bpm: round(bpm, 1),
    spectralCentroid: round(spectralCentroid, 0),
    irritationIndex: round(irritationIndex, 3),
    rationale: `RMS=${rms.toFixed(4)}, ZCR=${zcr.toFixed(
      3,
    )}, events=${events} over ${dur.toFixed(1)}s → ${state}.`,
  };
}

// ============================================================
// 3. EMERGENCY TRIAGE
// ============================================================

/**
 * Fuse all signals into a single sovereign verdict.
 *
 *  - lectin ≥ 0.75            → Critical (lectin spike)
 *  - vascularAsymmetry ≥ 0.70 → Critical (internal bleeding suspect)
 *  - emf ≥ 0.65               → Synthetic interference flag (not critical alone)
 *  - acoustic.lectin-irritation amplifies lectin
 */
export function emergencyTriage(input: TriageInput): TriageVerdict {
  const flags: string[] = [];

  let lectin = clamp01(input.lectin);
  const vascular = clamp01(input.vascularAsymmetry);
  const emf = clamp01(input.emf);

  if (input.acoustic?.state === "lectin-irritation") {
    lectin = clamp01(lectin + 0.15);
    flags.push("acoustic-lectin-amplifier");
  }

  // Blood group cross-reference: AB has fewer lectin antagonists → escalate sooner
  if (input.blood?.group === "AB" && lectin > 0.5) {
    lectin = clamp01(lectin + 0.08);
    flags.push("ab-lectin-vulnerability");
  }

  const lectinCritical = lectin >= 0.75;
  const bleedingCritical = vascular >= 0.7;
  const emfHigh = emf >= 0.65;

  if (lectinCritical) flags.push("lectin-spike-critical");
  if (bleedingCritical) flags.push("internal-bleeding-suspect");
  if (emfHigh) flags.push("synthetic-interference");

  // Composite score (0..100)
  const score = round(
    lectin * 40 + vascular * 40 + emf * 12 + (input.heartRate ? hrRisk(input.heartRate) * 8 : 0),
    1,
  );

  let level: TriageLevel;
  const critical = lectinCritical || bleedingCritical;

  if (critical && emfHigh) level = "sovereign-override";
  else if (critical) level = "critical";
  else if (score >= 55) level = "elevated";
  else if (score >= 30) level = "monitor";
  else level = "stable";

  return {
    level,
    score,
    flags,
    critical,
    directive: buildDirective(level, flags, input),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// HELPERS
// ============================================================

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function hrRisk(hr: number): number {
  // U-shaped: <50 or >120 → high
  if (hr < 50) return clamp01((50 - hr) / 30);
  if (hr > 120) return clamp01((hr - 120) / 60);
  return 0;
}

function buildDirective(
  level: TriageLevel,
  flags: string[],
  input: TriageInput,
): string {
  switch (level) {
    case "sovereign-override":
      return "SOVEREIGN OVERRIDE — Critical biological signal under synthetic interference. Move device away from EMF source and re-scan. Hand PDF to medic.";
    case "critical":
      if (flags.includes("internal-bleeding-suspect"))
        return "CRITICAL — Vascular asymmetry suggests internal bleeding. Generate PDF report and seek immediate clinical evaluation.";
      return "CRITICAL — Lectin spike detected. Generate PDF report. Stop ingestion, hydrate, and seek clinical evaluation.";
    case "elevated":
      return "ELEVATED — Multiple signals trending. Re-scan in 15 minutes. Hydrate and rest.";
    case "monitor":
      return "MONITOR — One signal elevated. Continue passive observation.";
    case "stable":
    default:
      return `STABLE — All sovereign signals within range${input.heartRate ? ` (HR ${input.heartRate} bpm)` : ""}.`;
  }
}
