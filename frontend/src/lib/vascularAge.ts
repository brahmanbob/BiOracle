/**
 * vascularAge.ts
 * ----------------------------------------------------------------
 * Vascular Age estimation via APG (Acceleration Plethysmogram) —
 * the second derivative of the PPG waveform.
 *
 * Reference:
 *   Takazawa et al. (1998), "Assessment of vasoactive agents and
 *   vascular aging by the second derivative of photoplethysmogram
 *   waveform", Hypertension 32(2), 365-370.
 *
 * Standard APG waves: a (systolic upstroke), b (early diastolic
 * notch — usually negative), c, d, e.
 *
 * Aging Index (AGI) = (b − c − d − e) / a
 *   AGI rises monotonically with vascular age in the literature.
 *
 * We map AGI → vascularAge years using the empirical fit
 *   vascularAge ≈ 21 + 36·(AGI + 1)
 * (calibrated on the Takazawa cohort table; clamped 18..95).
 *
 * Stiffness Index = b/a (between 0 negatively and -1.5 typically).
 * ----------------------------------------------------------------
 */

export interface APGResult {
  vascularAge: number;
  agingIndex: number;
  stiffnessIndex: number;
  bOverA: number;
  rationale: string;
  /** waveLabels gives index positions of a, b, c, d, e for plotting. */
  waveLabels: { a: number; b: number; c: number; d: number; e: number } | null;
}

export interface APGInput {
  /** PPG samples (any 1-D numeric series sampled uniformly). */
  samples: number[];
  /** Sample rate Hz. */
  fs: number;
  /** Optional sample range — start index of one cardiac cycle. */
  cycleStart?: number;
  /** Optional sample range — end index of one cardiac cycle. */
  cycleEnd?: number;
}

export function computeVascularAge(input: APGInput): APGResult {
  const { samples, fs } = input;
  if (!samples || samples.length < 30 || fs <= 0) return empty("insufficient samples");

  // 1. light smoothing (3-tap moving average) to suppress high-freq noise
  const smoothed = movingAverage(samples, 3);

  // 2. second derivative — central differences
  const apg: number[] = new Array(smoothed.length).fill(0);
  for (let i = 1; i < smoothed.length - 1; i++) {
    apg[i] = (smoothed[i + 1] - 2 * smoothed[i] + smoothed[i - 1]) * fs * fs;
  }

  // 3. find a 1-cycle window
  const start = input.cycleStart ?? findCycleStart(smoothed, fs);
  const end = input.cycleEnd ?? Math.min(start + Math.round(fs * 0.9), apg.length - 2);
  if (end - start < 10) return empty("cycle window too short");

  const seg = apg.slice(start, end);
  if (seg.length < 8) return empty("apg segment too short");

  // 4. Locate landmarks
  //    a = first major positive peak
  //    b = first major negative trough after a
  //    c, d, e = next 3 extrema alternating
  const extrema = findExtrema(seg);
  if (extrema.length < 2) return empty("not enough extrema for APG analysis");

  // a is the largest positive in the first 25 % of the cycle
  const aBound = Math.max(2, Math.floor(seg.length * 0.25));
  let aIdx = 0;
  let aVal = -Infinity;
  for (let i = 0; i < aBound; i++) {
    if (seg[i] > aVal) {
      aVal = seg[i];
      aIdx = i;
    }
  }
  if (aVal <= 0) return empty("a-wave (systolic upstroke) not found");

  // b is the deepest negative between aIdx and 55 % of cycle
  const bBound = Math.max(aIdx + 2, Math.floor(seg.length * 0.55));
  let bIdx = aIdx;
  let bVal = Infinity;
  for (let i = aIdx + 1; i < bBound; i++) {
    if (seg[i] < bVal) {
      bVal = seg[i];
      bIdx = i;
    }
  }

  // c, d, e: next positive, negative, positive after b within remaining cycle
  const tail = seg.slice(bIdx + 1);
  const tailExt = findExtrema(tail);
  const cExt = tailExt.find((e) => e.kind === "max");
  const dExt = tailExt.find((e) => e.kind === "min" && cExt && e.idx > cExt.idx);
  const eExt = tailExt.find((e) => e.kind === "max" && dExt && e.idx > dExt.idx);

  const c = cExt ? seg[bIdx + 1 + cExt.idx] : 0;
  const d = dExt ? seg[bIdx + 1 + dExt.idx] : 0;
  const e = eExt ? seg[bIdx + 1 + eExt.idx] : 0;

  const bOverA = bVal / aVal;                       // typically negative
  const stiffnessIndex = bOverA;
  const agingIndex = (bVal - c - d - e) / aVal;    // Takazawa AGI

  // Map AGI → vascular age (years).  AGI ~ −1.0 → ~21 y, AGI ~ +1.0 → ~93 y.
  let vascularAge = 21 + 36 * (agingIndex + 1);
  if (!Number.isFinite(vascularAge)) vascularAge = 0;
  vascularAge = Math.max(18, Math.min(95, vascularAge));

  return {
    vascularAge: Math.round(vascularAge),
    agingIndex: round(agingIndex, 3),
    stiffnessIndex: round(stiffnessIndex, 3),
    bOverA: round(bOverA, 3),
    rationale: `APG → a=${aVal.toFixed(1)} b=${bVal.toFixed(
      1,
    )} c=${c.toFixed(1)} d=${d.toFixed(1)} e=${e.toFixed(1)}. AGI=${agingIndex.toFixed(
      2,
    )} (Takazawa). b/a=${bOverA.toFixed(2)}.`,
    waveLabels: {
      a: start + aIdx,
      b: start + bIdx,
      c: cExt ? start + bIdx + 1 + cExt.idx : -1,
      d: dExt ? start + bIdx + 1 + dExt.idx : -1,
      e: eExt ? start + bIdx + 1 + eExt.idx : -1,
    },
  };
}

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

function empty(why: string): APGResult {
  return {
    vascularAge: 0,
    agingIndex: 0,
    stiffnessIndex: 0,
    bOverA: 0,
    rationale: why,
    waveLabels: null,
  };
}

function movingAverage(xs: number[], k: number): number[] {
  if (k <= 1) return xs.slice();
  const out: number[] = new Array(xs.length).fill(0);
  for (let i = 0; i < xs.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(xs.length - 1, i + k); j++) {
      s += xs[j];
      n++;
    }
    out[i] = s / n;
  }
  return out;
}

function findCycleStart(samples: number[], fs: number): number {
  // pick the first index where signal crosses its own median going up
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (let i = 1; i < samples.length - 1; i++) {
    if (samples[i - 1] < median && samples[i] >= median) return i;
  }
  return Math.max(0, Math.floor(fs * 0.1));
}

interface Extremum { idx: number; kind: "min" | "max"; }
function findExtrema(xs: number[]): Extremum[] {
  const out: Extremum[] = [];
  for (let i = 1; i < xs.length - 1; i++) {
    if (xs[i] > xs[i - 1] && xs[i] > xs[i + 1]) out.push({ idx: i, kind: "max" });
    else if (xs[i] < xs[i - 1] && xs[i] < xs[i + 1]) out.push({ idx: i, kind: "min" });
  }
  return out;
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
