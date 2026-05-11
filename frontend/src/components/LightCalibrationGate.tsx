import React, { useState } from "react";
import { calibrateLight, type LightCalibration } from "@/lib/lightCalibration";

interface Props {
  /** Which camera to use for the temperature sample. Default: rear. */
  facing?: "user" | "environment";
  /** Whether the gate is currently required (skin / sclera / tongue scans). */
  required?: boolean;
  /** Fired when calibration result is obtained (regardless of band). */
  onCalibrated?: (r: LightCalibration) => void;
  /** Fired when user accepts and is ready to scan. */
  onAccept: () => void;
  /** Compact mode: collapses to a chip after calibration. */
  compact?: boolean;
  testIdPrefix?: string;
}

/**
 * Light-calibration gate — guides the user to a colour-temperature
 * appropriate environment before a Bio-Beauty / Medical scan.
 */
const LightCalibrationGate: React.FC<Props> = ({
  facing = "environment", required, onCalibrated, onAccept, compact, testIdPrefix = "lightcal",
}) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LightCalibration | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await calibrateLight(facing);
      setResult(r);
      onCalibrated?.(r);
    } catch (e: any) {
      setErr(e?.message || "Camera unavailable for calibration");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bo-lightcal ${result?.band ?? ""} ${compact ? "compact" : ""}`} data-testid={`${testIdPrefix}-gate`}>
      <div className="head">
        <span className="lbl">⏚ LIGHT CALIBRATION</span>
        {result && <span className={`band band-${result.band}`}>{result.band.toUpperCase()} · {result.kelvin}K</span>}
      </div>

      {!result && !err && (
        <p className="hint">
          Lab-grade scans need a clean colour temperature. We'll briefly read the ambient light source before you start.
        </p>
      )}

      {result && (
        <div className="readout">
          <div className="metrics">
            <span>R/B <b>{result.rOverB}</b></span>
            <span>luma <b>{(result.meanLuma * 100).toFixed(0)}%</b></span>
          </div>
          {result.warning ? (
            <p className={`warn ${result.scanReady ? "" : "hard"}`} data-testid={`${testIdPrefix}-warn`}>
              {result.warning}
            </p>
          ) : (
            <p className="ok" data-testid={`${testIdPrefix}-ok`}>
              ☀ Natural daylight detected — clinical-grade conditions. Proceed.
            </p>
          )}
        </div>
      )}

      {err && <p className="bo-error">⚠︎ {err}</p>}

      <div className="ctl">
        {!result ? (
          <button className="bo-glass-btn primary" onClick={run} disabled={busy} data-testid={`${testIdPrefix}-run`}>
            {busy ? "Reading ambient…" : "Run Light Calibration"}
          </button>
        ) : (
          <>
            <button className="bo-glass-btn" onClick={run} data-testid={`${testIdPrefix}-redo`}>Re-calibrate</button>
            <button
              className="bo-glass-btn primary"
              onClick={onAccept}
              data-testid={`${testIdPrefix}-accept`}
            >
              {result.scanReady ? "Begin Scan" : (required ? "Proceed with caveat" : "Skip Calibration")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LightCalibrationGate;
