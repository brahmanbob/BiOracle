/**
 * skinAnalysis.ts
 * ----------------------------------------------------------------
 * Sub-Dermal Glow Index — rear-camera + flash skin scan.
 *
 *   • Mean (R, G, B) over the central region
 *   • Oxygenation proxy = R/(R+G+B) — higher = better perfusion
 *   • Uniformity = 1 − std(luminance) / mean(luminance) — smooth tone
 *   • Erythema = redVotes / total — irritation
 *   • Yellow shift = penalised
 *
 *   Glow Index = 100 × (0.45·oxygenation_n + 0.35·uniformity + 0.20·(1−erythema))
 *
 *   Sub-band reading: micro-circulation tier (poor/balanced/vivid).
 * ----------------------------------------------------------------
 */

export interface SkinReading {
  glowIndex: number;            // 0..100
  oxygenation: number;          // 0..1 normalised
  uniformity: number;           // 0..1
  erythema: number;             // 0..1
  yellowShift: number;          // 0..1 (penalty term)
  hydration: number;            // 0..1 (specular variance proxy)
  meanRGB: [number, number, number];
  tier: "depleted" | "balanced" | "radiant";
  rationale: string;
}

export function analyseSkin(img: ImageData): SkinReading {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const y0 = Math.round(h * 0.3);
  const y1 = Math.round(h * 0.7);
  const x0 = Math.round(w * 0.3);
  const x1 = Math.round(w * 0.7);

  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  let redVotes = 0, yellowVotes = 0;
  const lumValues: number[] = [];
  const specularValues: number[] = [];

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 35 || lum > 250) continue; // skip pure dark & blown-out specular
      rSum += r; gSum += g; bSum += b; n++;
      lumValues.push(lum);
      // specular highlight detector
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum > 200 && sat < 0.1) specularValues.push(lum);
      if (r > 190 && r > g + 18 && r > b + 18) redVotes++;
      if (r > 180 && g > 150 && b < 130 && r > b + 30) yellowVotes++;
    }
  }
  if (n < 80) {
    return {
      glowIndex: 0, oxygenation: 0, uniformity: 0,
      erythema: 0, yellowShift: 0, hydration: 0,
      meanRGB: [0, 0, 0], tier: "depleted",
      rationale: "Frame the cheek/forehead fully under flash and re-capture.",
    };
  }

  const mR = rSum / n;
  const mG = gSum / n;
  const mB = bSum / n;
  const total = mR + mG + mB || 1;
  const oxygenationRaw = mR / total; // ≈ 0.33 neutral, > 0.40 well-perfused
  const oxygenation = clamp01((oxygenationRaw - 0.30) / 0.18);

  const meanLum = lumValues.reduce((a, b) => a + b, 0) / lumValues.length;
  const variance = lumValues.reduce((a, b) => a + (b - meanLum) ** 2, 0) / lumValues.length;
  const stdLum = Math.sqrt(variance);
  const uniformity = clamp01(1 - stdLum / Math.max(1, meanLum) * 1.8);

  const erythema = clamp01(redVotes / n * 2);
  const yellowShift = clamp01(yellowVotes / n * 3);
  const hydration = clamp01(specularValues.length / n * 30); // some specular = moisture

  // composite
  const glowIndex = Math.round(
    100 *
      clamp01(
        oxygenation * 0.45 +
        uniformity * 0.35 +
        (1 - erythema) * 0.20 -
        yellowShift * 0.10,
      ),
  );

  let tier: SkinReading["tier"] = "balanced";
  if (glowIndex >= 78) tier = "radiant";
  else if (glowIndex < 52) tier = "depleted";

  return {
    glowIndex,
    oxygenation: round(oxygenation, 3),
    uniformity: round(uniformity, 3),
    erythema: round(erythema, 3),
    yellowShift: round(yellowShift, 3),
    hydration: round(hydration, 3),
    meanRGB: [Math.round(mR), Math.round(mG), Math.round(mB)],
    tier,
    rationale:
      tier === "radiant"
        ? "Sub-dermal perfusion vivid, tone uniform — sustain hydration & sleep cadence."
        : tier === "depleted"
        ? "Low perfusion / uneven tone — micro-circulation work (gua sha 2min, dry brush AM, omega-3 600mg)."
        : "Within range — refine: 2 L water, 8h sleep, retinol cycle 2×/wk.",
  };
}

function clamp01(x: number) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function round(x: number, dp: number) {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
