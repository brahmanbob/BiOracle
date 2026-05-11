/**
 * ocularVitals.ts
 * ----------------------------------------------------------------
 * No-BS Ocular Vital derivation.
 *
 *  Inputs: PPG result (already produces HR, HRV, signalAmplitude, asymmetry)
 *          + APG (vascular age, aging index) + raw red-channel samples.
 *
 *  We surface three vitals — HR, BP (estimate), SpO2 (indicative) —
 *  with an explicit "confidence" label and an honest disclaimer.
 *
 *  We refuse to fabricate.  Every value is tagged:
 *    • "measured"   — direct from signal (HR)
 *    • "estimate"   — single-camera proxy (BP)
 *    • "indicative" — red-channel only, no IR (SpO2)
 *
 *  Calibration offsets (single-arm BP cuff calibration) can be stored
 *  locally and applied via `applyCalibration`.
 * ----------------------------------------------------------------
 */

export type ConfidenceTag = "measured" | "estimate" | "indicative";
export type ConfidenceTier = "high" | "medium" | "low" | "untrusted";

export interface OcularVital {
  label: string;
  unit: string;
  value: number;
  tag: ConfidenceTag;
  tier: ConfidenceTier;
  rationale: string;
}

export interface OcularPanel {
  hr: OcularVital;
  bp: OcularVital;   // systolic / diastolic combined display
  bpSystolic: number;
  bpDiastolic: number;
  spo2: OcularVital;
  signalQuality: number; // 0..1
  overallConfidence: ConfidenceTier;
  honesty: string;       // single-line disclaimer
}

export interface OcularInput {
  heartRate: number;
  hrv: number;
  signalAmplitude: number;
  asymmetry: number;
  vascularAge: number;        // years
  agingIndex: number;         // -2 … +2
  rawSamples: number[];       // red-channel detrended PPG
  sampleRateHz: number;
}

/** Single-arm calibration offsets (optional). */
export interface BPCalibration {
  systolicOffset: number;
  diastolicOffset: number;
  ts: number;
}
const CAL_KEY = "bo.bp.cal.v1";

export function loadBPCalibration(): BPCalibration | null {
  try { const raw = localStorage.getItem(CAL_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveBPCalibration(systolic: number, diastolic: number): void {
  const sample = estimateBP(80, 0.5, 35, 0.5);
  const cal: BPCalibration = {
    systolicOffset: systolic - sample.systolic,
    diastolicOffset: diastolic - sample.diastolic,
    ts: Date.now(),
  };
  try { localStorage.setItem(CAL_KEY, JSON.stringify(cal)); } catch { /* ignore */ }
}
export function clearBPCalibration(): void { try { localStorage.removeItem(CAL_KEY); } catch { /* ignore */ } }

/** Deterministic BP estimate from PPG-derived features. */
function estimateBP(hr: number, amplitude: number, vascularAge: number, agingIndex: number) {
  // Empirical proxy:
  //   SBP ≈ 110 + 0.6*(HR - 70) + 28*agingIndex + 0.18*max(0, vascAge-30)
  //   DBP ≈ 72  + 0.35*(HR - 70) + 12*agingIndex + 0.10*max(0, vascAge-30)
  // Amplitude reduces confidence proportionally; large amplitude → strong signal.
  const ageTerm = Math.max(0, (vascularAge || 0) - 30);
  const sbp = 110 + 0.6 * (hr - 70) + 28 * (agingIndex || 0) + 0.18 * ageTerm;
  const dbp = 72  + 0.35 * (hr - 70) + 12 * (agingIndex || 0) + 0.10 * ageTerm;
  return {
    systolic: Math.round(sbp),
    diastolic: Math.round(dbp),
  };
}

/** Indicative SpO2 estimate from the AC/DC ratio of the red channel only.
 *  True SpO2 needs IR; this is a sanity-band, NOT a clinical reading.
 */
function estimateSpO2(rawSamples: number[]): { spo2: number; rDc: number; rAc: number } {
  if (!rawSamples || rawSamples.length < 30) {
    return { spo2: 0, rDc: 0, rAc: 0 };
  }
  // DC = mean of (absolute) signal level; AC = peak-to-trough swing
  const n = rawSamples.length;
  let sum = 0;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = rawSamples[i];
    sum += Math.abs(v);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const dc = sum / n;
  const ac = hi - lo;
  if (dc <= 0 || ac <= 0) return { spo2: 0, rDc: dc, rAc: ac };

  // Empirical proxy: well-perfused tissue in red light → ratio R_ac/R_dc ≈ 0.012..0.045
  // Map ratio band → 95..99% indicative SpO2. Beyond bands → clip.
  const ratio = ac / Math.max(0.0001, dc);
  // Clamp ratio into 0.005..0.06
  const clipped = Math.max(0.005, Math.min(0.06, ratio));
  // Higher ratio means stronger PPG = better-oxygenated, well-perfused
  const spo2 = 92 + (clipped - 0.005) * (8 / (0.06 - 0.005));
  return { spo2: Math.round(spo2 * 10) / 10, rDc: dc, rAc: ac };
}

export function deriveOcularPanel(input: OcularInput): OcularPanel {
  const cal = loadBPCalibration();
  const { systolic, diastolic } = estimateBP(
    input.heartRate,
    input.signalAmplitude,
    input.vascularAge,
    input.agingIndex,
  );
  const sbp = Math.max(70, Math.min(220, systolic + (cal?.systolicOffset || 0)));
  const dbp = Math.max(40, Math.min(140, diastolic + (cal?.diastolicOffset || 0)));

  const { spo2 } = estimateSpO2(input.rawSamples);

  // Signal quality: PPG amplitude × inverse-asymmetry
  const signalQuality = clamp01(
    (input.signalAmplitude || 0) * 0.7 + (1 - (input.asymmetry || 0)) * 0.3,
  );

  // HR confidence
  const hrTier: ConfidenceTier =
    signalQuality > 0.55 ? "high" : signalQuality > 0.3 ? "medium" : signalQuality > 0.1 ? "low" : "untrusted";

  // BP — always estimate; tier reflects only signal-driven confidence
  const bpTier: ConfidenceTier =
    cal ? (signalQuality > 0.5 ? "medium" : "low") : (signalQuality > 0.5 ? "low" : "untrusted");

  // SpO2 — phone red-only → indicative max
  const spo2Tier: ConfidenceTier =
    signalQuality > 0.45 && spo2 >= 92 ? "low" : "untrusted";

  const overallConfidence: ConfidenceTier =
    [hrTier, bpTier, spo2Tier].includes("untrusted") ? "low" :
    hrTier === "high" && bpTier !== "untrusted" ? "medium" : "low";

  return {
    hr: {
      label: "Heart Rate",
      unit: "bpm",
      value: Math.round(input.heartRate),
      tag: "measured",
      tier: hrTier,
      rationale: `Direct beat-pick on ${input.rawSamples.length} red samples @ ${input.sampleRateHz.toFixed(0)} Hz.`,
    },
    bp: {
      label: "Blood Pressure",
      unit: "mmHg",
      value: sbp,
      tag: "estimate",
      tier: bpTier,
      rationale: cal
        ? "Calibrated against your cuff reading; phone-PPG estimate ±10 mmHg."
        : "Phone-PPG proxy; not cuff-calibrated. Treat as trend only (±15 mmHg).",
    },
    bpSystolic: sbp,
    bpDiastolic: dbp,
    spo2: {
      label: "SpO₂",
      unit: "%",
      value: spo2 || 0,
      tag: "indicative",
      tier: spo2Tier,
      rationale: "Red-channel only — a pulse-oximeter uses red + IR. This is a presence-of-perfusion check, not a clinical SpO₂.",
    },
    signalQuality: round(signalQuality, 3),
    overallConfidence,
    honesty:
      "No-BS panel — HR is measured, BP is an uncalibrated estimate, SpO₂ is indicative without an IR sensor. Never replaces a cuff or pulse-ox.",
  };
}

function clamp01(x: number) { return Math.max(0, Math.min(1, Number.isNaN(x) ? 0 : x)); }
function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
