/**
 * useMagnetometer.ts
 * ----------------------------------------------------------------
 * Generic Sensor API Magnetometer.
 *
 *   • Reads x, y, z in µT (microtesla) at 10 Hz
 *   • magnitude = sqrt(x² + y² + z²)
 *   • Earth's geomagnetic field baseline ≈ 25–65 µT
 *   • > 65 µT → synthetic interference (phone-to-head EMF saturation)
 *   • Normalises into a 0..1 emf index for SovereignLogic.emergencyTriage
 *
 * Fallbacks:
 *   • If Magnetometer constructor missing → reports `unavailable`
 *   • If permission denied → reports `permissionError`
 *   • Caller may keep slider control in that case
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface MagState {
  active: boolean;
  available: boolean;
  permissionError: string | null;
  x: number;
  y: number;
  z: number;
  microtesla: number;
  emfIndex: number;            // 0..1, fed into emergencyTriage
  syntheticInterference: boolean;
  baseline: number;            // running median (µT) — environment
  spikes: number;              // # of >65µT events since start
}

const SPIKE_THRESHOLD = 65;

export function useMagnetometer() {
  const [state, setState] = useState<MagState>({
    active: false,
    available: typeof (window as any).Magnetometer === "function",
    permissionError: null,
    x: 0,
    y: 0,
    z: 0,
    microtesla: 0,
    emfIndex: 0,
    syntheticInterference: false,
    baseline: 0,
    spikes: 0,
  });

  const sensorRef = useRef<any>(null);
  const samplesRef = useRef<number[]>([]);
  const spikesRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (sensorRef.current) {
      try { sensorRef.current.stop(); } catch (_) { /* ignore */ }
      sensorRef.current = null;
    }
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null }));
    const W = window as any;
    if (typeof W.Magnetometer !== "function") {
      setState((s) => ({
        ...s,
        available: false,
        permissionError:
          "Magnetometer API not available — open BiOracle directly in Chrome on S21 (not inside an iframe).",
      }));
      return;
    }
    try {
      // Permissions (best-effort; not all browsers expose this)
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const res = await (navigator.permissions as any).query({ name: "magnetometer" });
          if (res.state === "denied") {
            setState((s) => ({ ...s, permissionError: "Magnetometer permission denied." }));
            return;
          }
        } catch (_) { /* permission name may not be supported, continue */ }
      }
      const sensor = new W.Magnetometer({ frequency: 10, referenceFrame: "device" });
      sensorRef.current = sensor;
      samplesRef.current = [];
      spikesRef.current = 0;

      sensor.addEventListener("reading", () => {
        const x = sensor.x ?? 0;
        const y = sensor.y ?? 0;
        const z = sensor.z ?? 0;
        const mt = Math.sqrt(x * x + y * y + z * z);
        samplesRef.current.push(mt);
        if (samplesRef.current.length > 200) samplesRef.current.shift();
        const sorted = [...samplesRef.current].sort((a, b) => a - b);
        const baseline = sorted[Math.floor(sorted.length / 2)] || 0;
        const synthetic = mt > SPIKE_THRESHOLD;
        if (synthetic) spikesRef.current += 1;
        // emf index: 0 below 30µT, 0.65 at threshold, 1.0 at 150µT
        const emfIndex = clamp01((mt - 30) / 120);
        setState((s) => ({
          ...s,
          active: true,
          x, y, z,
          microtesla: round(mt, 2),
          baseline: round(baseline, 2),
          emfIndex: round(emfIndex, 3),
          syntheticInterference: synthetic,
          spikes: spikesRef.current,
        }));
      });
      sensor.addEventListener("error", (e: any) => {
        setState((s) => ({
          ...s,
          permissionError: e?.error?.message || "Magnetometer error",
          active: false,
        }));
      });
      sensor.start();
      setState((s) => ({ ...s, active: true }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        permissionError: e?.message || "Magnetometer start failed",
        active: false,
      }));
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, SPIKE_THRESHOLD };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
