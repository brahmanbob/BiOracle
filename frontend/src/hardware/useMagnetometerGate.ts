/**
 * useMagnetometerGate.ts
 * ----------------------------------------------------------------
 *  Auto-Stealth pre-scan gate.
 *
 *  Before allowing a sensor-heavy scan (PPG / camera / mic) to begin,
 *  we run a short magnetometer "ping" to confirm:
 *    1. The Magnetometer sensor is available on this device.
 *    2. A baseline read settles (≥ 6 samples over ~1.5 s).
 *    3. The current field is BELOW the synthetic-interference threshold
 *       (default 65 µT) at the moment of probe.
 *    4. The 1.5 s window contains no >65 µT spike.
 *
 *  If all four conditions pass → `gate.status = "clear"` and the
 *  caller may start the scan.  Otherwise:
 *    • "unavailable"   — sensor missing (sensor cannot enforce gate)
 *    • "permission"    — denied
 *    • "interference"  — live µT or recent spike too high
 *    • "settling"      — not enough samples yet
 *
 *  The gate is non-blocking: the caller can force-bypass, but the
 *  PetScene / OcularScan / DigestionScene wire it as a precondition.
 * ----------------------------------------------------------------
 */
import { useCallback, useRef, useState } from "react";

export type MagGateStatus =
  | "idle"
  | "settling"
  | "clear"
  | "interference"
  | "unavailable"
  | "permission";

export interface MagGateReport {
  status: MagGateStatus;
  samples: number;
  meanMicrotesla: number;
  peakMicrotesla: number;
  recentSpikes: number;
  durationMs: number;
  decidedAt: number;       // performance.now()
  message: string;
}

const SPIKE_THRESHOLD = 65;
const BASELINE_SAMPLES = 6;
const PROBE_DURATION_MS = 1500;
const SAMPLE_HZ = 8;

export function useMagnetometerGate() {
  const [report, setReport] = useState<MagGateReport>({
    status: "idle",
    samples: 0,
    meanMicrotesla: 0,
    peakMicrotesla: 0,
    recentSpikes: 0,
    durationMs: 0,
    decidedAt: 0,
    message: "Gate idle.",
  });
  const probingRef = useRef(false);

  const probe = useCallback(async (): Promise<MagGateReport> => {
    if (probingRef.current) return report;
    probingRef.current = true;

    const start = performance.now();
    const SensorCtor = (window as any).Magnetometer;
    if (typeof SensorCtor !== "function") {
      const r: MagGateReport = {
        status: "unavailable",
        samples: 0,
        meanMicrotesla: 0,
        peakMicrotesla: 0,
        recentSpikes: 0,
        durationMs: 0,
        decidedAt: performance.now(),
        message: "Magnetometer API not exposed on this runtime — gate cannot enforce.",
      };
      probingRef.current = false;
      setReport(r);
      return r;
    }

    let sensor: any = null;
    const samples: number[] = [];
    let peak = 0;
    let spikes = 0;

    return new Promise<MagGateReport>((resolve) => {
      const finish = (status: MagGateStatus, msg: string) => {
        if (sensor) { try { sensor.stop(); } catch { /* ignore */ } }
        const mean = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
        const r: MagGateReport = {
          status,
          samples: samples.length,
          meanMicrotesla: round(mean, 2),
          peakMicrotesla: round(peak, 2),
          recentSpikes: spikes,
          durationMs: Math.round(performance.now() - start),
          decidedAt: performance.now(),
          message: msg,
        };
        probingRef.current = false;
        setReport(r);
        resolve(r);
      };

      try {
        sensor = new SensorCtor({ frequency: SAMPLE_HZ });
        sensor.onreading = () => {
          const x = sensor.x ?? 0;
          const y = sensor.y ?? 0;
          const z = sensor.z ?? 0;
          const ut = Math.sqrt(x * x + y * y + z * z);
          samples.push(ut);
          if (ut > peak) peak = ut;
          if (ut > SPIKE_THRESHOLD) spikes++;
          setReport((prev) => ({
            ...prev,
            status: samples.length < BASELINE_SAMPLES ? "settling" : prev.status,
            samples: samples.length,
            meanMicrotesla: round(samples.reduce((a, b) => a + b, 0) / samples.length, 2),
            peakMicrotesla: round(peak, 2),
            recentSpikes: spikes,
            durationMs: Math.round(performance.now() - start),
            message: samples.length < BASELINE_SAMPLES
              ? `Settling… ${samples.length}/${BASELINE_SAMPLES}`
              : prev.message,
          }));
        };
        sensor.onerror = (e: any) => {
          const name = e?.error?.name || "";
          if (name === "NotAllowedError" || name === "SecurityError") {
            finish("permission", "Magnetometer permission denied.");
          } else {
            finish("unavailable", `Magnetometer error: ${e?.error?.message || name || "unknown"}`);
          }
        };
        sensor.start();
        setReport((p) => ({ ...p, status: "settling", message: "Probing magnetic field…" }));

        // Decision after PROBE_DURATION_MS
        setTimeout(() => {
          if (samples.length < BASELINE_SAMPLES) {
            finish(
              "settling",
              `Only ${samples.length} samples in ${PROBE_DURATION_MS} ms — sensor may be permission-gated.`,
            );
            return;
          }
          const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
          // Look at last 4 samples for a fresh-spike check
          const recent = samples.slice(-4);
          const recentPeak = Math.max(...recent);
          if (mean > SPIKE_THRESHOLD || recentPeak > SPIKE_THRESHOLD || spikes > 0) {
            finish(
              "interference",
              `Synthetic interference detected — mean ${mean.toFixed(1)} µT, peak ${peak.toFixed(1)} µT, ${spikes} spike(s) > ${SPIKE_THRESHOLD} µT.`,
            );
          } else {
            finish(
              "clear",
              `Clear — mean ${mean.toFixed(1)} µT, peak ${peak.toFixed(1)} µT (Earth-band).`,
            );
          }
        }, PROBE_DURATION_MS);
      } catch (e: any) {
        finish("unavailable", `Magnetometer construct failed: ${e?.message || "unknown"}`);
      }
    });
  }, [report]);

  const reset = useCallback(() => {
    setReport({
      status: "idle",
      samples: 0,
      meanMicrotesla: 0,
      peakMicrotesla: 0,
      recentSpikes: 0,
      durationMs: 0,
      decidedAt: 0,
      message: "Gate idle.",
    });
  }, []);

  return { report, probe, reset };
}

function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
