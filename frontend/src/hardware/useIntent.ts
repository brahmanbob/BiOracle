/**
 * useIntent.ts
 * Contextual Stealth — fuses magnetometer stability + reading patterns
 * (motion dwell + visibility) into a 0..1 intent score.
 *
 *   intent score = w1·dwell + w2·motionStability + w3·magStability + w4·visibility
 *
 *   • dwell           — fraction of last 30 s with no scroll/touch
 *   • motionStability — 1 - normalised devicemotion accel variance
 *   • magStability    — 1 - normalised µT variance (if magnetometer active)
 *   • visibility      — document.visibilityState === "visible"
 *
 * stealthEngaged = magSpike  &&  intent > 0.6
 *   ↳ "EMF interference while the carrier is focused on the screen" → real attack vector.
 */
import { useEffect, useRef, useState } from "react";

export interface IntentState {
  intent: number;        // 0..1
  dwell: number;
  motionStability: number;
  magStability: number;
  visibility: boolean;
  /** True iff EMF spike + high intent (contextual stealth target) */
  stealthEngaged: boolean;
  lastTouchSec: number;
}

const WINDOW = 30; // seconds rolling window
const SPIKE_T = 65;

export function useIntent(magMicrotesla: number | null): IntentState {
  const [state, setState] = useState<IntentState>({
    intent: 0,
    dwell: 0,
    motionStability: 1,
    magStability: 1,
    visibility: true,
    stealthEngaged: false,
    lastTouchSec: 0,
  });

  const motionBuf = useRef<number[]>([]);
  const magBuf = useRef<number[]>([]);
  const lastTouchRef = useRef<number>(Date.now());

  // Touch / scroll activity → resets dwell
  useEffect(() => {
    const ping = () => { lastTouchRef.current = Date.now(); };
    window.addEventListener("touchstart", ping, { passive: true });
    window.addEventListener("scroll", ping, { passive: true });
    window.addEventListener("pointerdown", ping, { passive: true });
    window.addEventListener("keydown", ping, { passive: true });
    return () => {
      window.removeEventListener("touchstart", ping);
      window.removeEventListener("scroll", ping);
      window.removeEventListener("pointerdown", ping);
      window.removeEventListener("keydown", ping);
    };
  }, []);

  // DeviceMotion for motion-stability
  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      motionBuf.current.push(mag);
      if (motionBuf.current.length > 60) motionBuf.current.shift();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  // Push mag samples into ring
  useEffect(() => {
    if (typeof magMicrotesla === "number" && magMicrotesla > 0) {
      magBuf.current.push(magMicrotesla);
      if (magBuf.current.length > 100) magBuf.current.shift();
    }
  }, [magMicrotesla]);

  // Tick once per second
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const lastTouchSec = (now - lastTouchRef.current) / 1000;
      const dwell = Math.min(1, lastTouchSec / WINDOW);

      // motion stability
      const m = motionBuf.current;
      let motionStability = 1;
      if (m.length > 5) {
        const mean = m.reduce((a, b) => a + b, 0) / m.length;
        const v = m.reduce((a, b) => a + (b - mean) ** 2, 0) / m.length;
        motionStability = Math.max(0, Math.min(1, 1 - Math.sqrt(v) / 4));
      }

      // mag stability (low variance = stable)
      const mg = magBuf.current;
      let magStability = 1;
      if (mg.length > 5) {
        const mean = mg.reduce((a, b) => a + b, 0) / mg.length;
        const v = mg.reduce((a, b) => a + (b - mean) ** 2, 0) / mg.length;
        magStability = Math.max(0, Math.min(1, 1 - Math.sqrt(v) / 30));
      }

      const visibility = typeof document !== "undefined" && document.visibilityState === "visible";

      const intent = clamp01(
        dwell * 0.4 + motionStability * 0.3 + magStability * 0.15 + (visibility ? 0.15 : 0),
      );

      const stealthEngaged =
        (typeof magMicrotesla === "number" && magMicrotesla > SPIKE_T) && intent > 0.6;

      setState({ intent: round(intent, 3), dwell: round(dwell, 3), motionStability: round(motionStability, 3),
                 magStability: round(magStability, 3), visibility, stealthEngaged, lastTouchSec: round(lastTouchSec, 1) });
    }, 1000);
    return () => clearInterval(id);
  }, [magMicrotesla]);

  return state;
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
