/**
 * anabolicWindow.ts
 * ----------------------------------------------------------------
 * Post-set HRV recovery → Anabolic Window status.
 *
 *  • Stores a 7-day rolling **resting HRV baseline** in localStorage.
 *  • Post-set HRV (current) is compared to baseline.
 *  • Window OPEN when current HRV ≥ 0.85 × baseline AND HR within
 *    +10 bpm of resting HR (logged separately).
 *  • Returns recovery percentage + status + tactical directive.
 *
 *  Pure functions + a tiny persistence helper.
 * ----------------------------------------------------------------
 */

const KEY_BASELINE = "bo.cruise.hrvBaseline";
const KEY_REST_HR = "bo.cruise.restHr";
const KEY_HISTORY = "bo.cruise.history.v1";

export interface AnabolicWindow {
  /** "open" / "warming" / "depleted" / "no-baseline" */
  status: "open" | "warming" | "depleted" | "no-baseline";
  recoveryPct: number;        // 0..1 = HRV_current / HRV_baseline
  hrDelta: number;            // current_HR − resting_HR (bpm)
  baselineHrv: number;
  baselineRestHr: number;
  directive: string;
}

export interface CruiseHistoryEntry {
  ts: string;
  hrv: number;
  hr: number;
  recoveryPct: number;
  status: AnabolicWindow["status"];
}

export function getBaselineHrv(): number {
  const v = parseFloat(localStorage.getItem(KEY_BASELINE) || "");
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function getBaselineRestHr(): number {
  const v = parseFloat(localStorage.getItem(KEY_REST_HR) || "");
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Push a new resting reading into the rolling-7 baseline.
 * Pre-set scans should call this BEFORE training.
 */
export function pushBaseline(hrv: number, restHr: number): { hrv: number; restHr: number } {
  const prev = getBaselineHrv();
  const prevHr = getBaselineRestHr();
  // exponential smoothing α=0.3 (≈ last-7 weighted average)
  const a = 0.3;
  const newHrv = prev > 0 ? prev * (1 - a) + hrv * a : hrv;
  const newHr = prevHr > 0 ? prevHr * (1 - a) + restHr * a : restHr;
  localStorage.setItem(KEY_BASELINE, String(newHrv));
  localStorage.setItem(KEY_REST_HR, String(newHr));
  return { hrv: newHrv, restHr: newHr };
}

export function evaluatePostSet(currentHrv: number, currentHr: number): AnabolicWindow {
  const baselineHrv = getBaselineHrv();
  const baselineRestHr = getBaselineRestHr();
  if (baselineHrv <= 0) {
    return {
      status: "no-baseline",
      recoveryPct: 0,
      hrDelta: currentHr - (baselineRestHr || currentHr),
      baselineHrv: 0,
      baselineRestHr,
      directive: "NO BASELINE — capture a resting scan tomorrow morning before training to enable Anabolic Window logic.",
    };
  }
  const recoveryPct = baselineHrv > 0 ? currentHrv / baselineHrv : 0;
  const hrDelta = currentHr - (baselineRestHr || currentHr);

  let status: AnabolicWindow["status"];
  let directive: string;
  if (recoveryPct >= 0.85 && hrDelta <= 18) {
    status = "open";
    directive = "ANABOLIC WINDOW OPEN — protein 30-45g + carbs now. Mobility ≥ 8 min. Hit the next compound in 4-8 min.";
  } else if (recoveryPct >= 0.65) {
    status = "warming";
    directive = "WARMING — finish breathing reset (box 4-4-4-4 × 6) then re-scan in 90 s.";
  } else {
    status = "depleted";
    directive = "DEPLETED — drop intensity, hydrate 500 ml + electrolytes, switch to accessory work or end session.";
  }
  return {
    status,
    recoveryPct: round(recoveryPct, 3),
    hrDelta: round(hrDelta, 1),
    baselineHrv: round(baselineHrv, 1),
    baselineRestHr: round(baselineRestHr, 1),
    directive,
  };
}

export function pushHistory(entry: CruiseHistoryEntry): CruiseHistoryEntry[] {
  const raw = localStorage.getItem(KEY_HISTORY);
  let arr: CruiseHistoryEntry[] = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  arr.unshift(entry);
  arr = arr.slice(0, 40);
  localStorage.setItem(KEY_HISTORY, JSON.stringify(arr));
  return arr;
}

export function getHistory(): CruiseHistoryEntry[] {
  const raw = localStorage.getItem(KEY_HISTORY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
