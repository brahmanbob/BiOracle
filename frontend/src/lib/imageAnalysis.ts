/**
 * imageAnalysis.ts
 * ----------------------------------------------------------------
 * Lightweight pixel-domain heuristics for the front-camera scans.
 *  - analyseSclera(image, mask?)  → yellowness, redness, dryness
 *  - analyseTongue(image)         → color, coating, fissure proxy
 *
 * Pure functions on ImageData — no DOM, no React.
 * ----------------------------------------------------------------
 */

export interface ScleraReading {
  yellowness: number;     // 0..1 (high = elevated bilirubin / β-carotene depletion)
  redness: number;        // 0..1 (vascular irritation)
  dryness: number;        // 0..1 (low spectral contrast proxy)
  meanRGB: [number, number, number];
  indicator: "stable" | "watch" | "irritated" | "jaundiced";
  rationale: string;
}

export interface TongueReading {
  redness: number;        // 0..1
  paleness: number;       // 0..1 — low saturation
  coating: number;        // 0..1 — high-luminance white film share
  hue: "pink" | "pale" | "crimson" | "purple" | "yellow";
  state: "healthy" | "qi-deficient" | "heat" | "stasis" | "damp-heat";
  rationale: string;
}

export type ScanLighting = "indoor" | "morning" | "auto";

export function analyseSclera(img: ImageData, lighting: ScanLighting = "indoor"): ScleraReading {
  // Morning calibration: indirect sunlight pushes overall luminance up and
  // skews white-balance toward blue. We raise the bright-pixel mask floor and
  // increase the yellowness threshold so a bright wash isn't misread as jaundice.
  const LUM_FLOOR = lighting === "morning" ? 140 : 100;
  const YELLOW_DENOMINATOR = lighting === "morning" ? 200 : 160;
  const REDNESS_BIAS = lighting === "morning" ? 0.85 : 1.0;

  // sample a central horizontal strip — sclera spans the wide axis under most poses
  const w = img.width;
  const h = img.height;
  const data = img.data;

  const y0 = Math.round(h * 0.4);
  const y1 = Math.round(h * 0.6);
  const x0 = Math.round(w * 0.2);
  const x1 = Math.round(w * 0.8);

  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  let yellowVotes = 0, redVotes = 0;
  let lumValues: number[] = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // mask to highly-luminous pixels (sclera/skin/teeth) — drop pupils, lashes
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < LUM_FLOOR) continue; // skip dark pupils & lashes (morning lifts the floor)
      rSum += r; gSum += g; bSum += b; n++;
      lumValues.push(lum);
      if (r > 180 && g > 150 && b < 130) yellowVotes++;
      if (r > 200 && g < 140 && b < 140) redVotes++;
    }
  }

  if (n < 50) {
    return {
      yellowness: 0, redness: 0, dryness: 0,
      meanRGB: [0, 0, 0],
      indicator: "watch",
      rationale: "Insufficient bright-pixel sample — re-frame face / open eyes wider.",
    };
  }

  const mR = rSum / n;
  const mG = gSum / n;
  const mB = bSum / n;

  // yellowness: how much R+G dominates over B  (jaundice / β-carotene depletion)
  const yellowness = clamp01(((mR + mG) / 2 - mB) / YELLOW_DENOMINATOR);
  const redness = REDNESS_BIAS * clamp01(yellowVotes ? redVotes / (yellowVotes + redVotes + 1) : redVotes / Math.max(1, n / 80));

  // dryness proxy: low luminance variance = matte sclera (more moist scleras refract light)
  const meanLum = lumValues.reduce((a, b) => a + b, 0) / lumValues.length;
  const variance = lumValues.reduce((a, b) => a + (b - meanLum) ** 2, 0) / lumValues.length;
  const dryness = clamp01(1 - Math.sqrt(variance) / 40);

  let indicator: ScleraReading["indicator"] = "stable";
  if (yellowness > 0.55) indicator = "jaundiced";
  else if (redness > 0.4) indicator = "irritated";
  else if (yellowness > 0.32 || dryness > 0.7) indicator = "watch";

  return {
    yellowness: round(yellowness, 3),
    redness: round(redness, 3),
    dryness: round(dryness, 3),
    meanRGB: [Math.round(mR), Math.round(mG), Math.round(mB)],
    indicator,
    rationale:
      indicator === "jaundiced"
        ? "Sclera yellow shift detected — review liver / β-carotene status."
        : indicator === "irritated"
        ? "Conjunctival redness elevated — hydration / allergen check."
        : indicator === "watch"
        ? "Mild yellowness or matte sheen — re-scan in 24h."
        : "Sclera within sovereign baseline.",
  };
}

export function analyseTongue(img: ImageData, lighting: ScanLighting = "indoor"): TongueReading {
  // Morning mode lifts the saturation/redness thresholds because indirect sunlight
  // adds chroma to the tongue body that we don't want misread as "heat".
  const COATING_GAIN = lighting === "morning" ? 1.6 : 2.0;
  const REDNESS_GAIN = lighting === "morning" ? 1.2 : 1.5;
  const CRIMSON_LUM = lighting === "morning" ? 195 : 180;

  const w = img.width;
  const h = img.height;
  const data = img.data;

  // central body of the tongue — square region in the middle
  const y0 = Math.round(h * 0.25);
  const y1 = Math.round(h * 0.75);
  const x0 = Math.round(w * 0.25);
  const x1 = Math.round(w * 0.75);

  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  let whiteCoat = 0;
  let totalReddish = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      rSum += r; gSum += g; bSum += b; n++;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // white coating: high luminance + low saturation
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum > 170 && sat < 0.18) whiteCoat++;
      if (r > 150 && r > g + 18 && r > b + 18) totalReddish++;
    }
  }
  if (n < 30) {
    return {
      redness: 0, paleness: 0, coating: 0,
      hue: "pale",
      state: "qi-deficient",
      rationale: "Frame the tongue body fully and re-capture.",
    };
  }

  const mR = rSum / n;
  const mG = gSum / n;
  const mB = bSum / n;
  const maxc = Math.max(mR, mG, mB);
  const minc = Math.min(mR, mG, mB);
  const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;

  const coating = clamp01(whiteCoat / n * COATING_GAIN);
  const redness = clamp01(totalReddish / n * REDNESS_GAIN);
  const paleness = clamp01((1 - sat) * 0.7 + (mR < 150 ? 0.3 : 0));

  // hue classification
  let hue: TongueReading["hue"] = "pink";
  if (mR > CRIMSON_LUM && mG > 110 && mB < 100 && sat > 0.25) hue = "crimson";
  else if (mB > mR - 10 && mB > 110) hue = "purple";
  else if (mR > 170 && mG > 150 && mB < 110) hue = "yellow";
  else if (sat < 0.18 && mR < 165) hue = "pale";

  // TCM-ish state
  let state: TongueReading["state"] = "healthy";
  if (hue === "pale" && paleness > 0.55) state = "qi-deficient";
  else if (hue === "crimson" || redness > 0.55) state = "heat";
  else if (hue === "purple") state = "stasis";
  else if (coating > 0.45 && hue === "yellow") state = "damp-heat";

  return {
    redness: round(redness, 3),
    paleness: round(paleness, 3),
    coating: round(coating, 3),
    hue,
    state,
    rationale:
      state === "qi-deficient"
        ? "Pale & low-saturation tongue body — iron / B-12 / adrenal review."
        : state === "heat"
        ? "Crimson body — hydration + cooling foods (cucumber, mung bean)."
        : state === "stasis"
        ? "Purple tint — circulation stagnation; light cardio + warming spices."
        : state === "damp-heat"
        ? "Yellow coating — reduce refined sugar & dairy, bitters indicated."
        : "Tongue body within sovereign baseline.",
  };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
