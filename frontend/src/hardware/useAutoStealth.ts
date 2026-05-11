/**
 * useAutoStealth.ts
 * ----------------------------------------------------------------
 * Trinity Invention — Auto-Stealth orchestrator.
 *
 *  Combines `useIntent.autoStealthEngaged` (proactive: phone static + screen on
 *  + dwelling) with `useNativeBridge.suppressRadio()` and emits a single
 *  observable state plus side-effects:
 *
 *    • engage      → fires bridge.suppressRadio() once (wake-lock, ABORT_BUS,
 *                    Capacitor RadioSuppress plugin if present)
 *    • disengage   → bridge.releaseRadio()
 *    • observable  → `engagedSince` (ms), `lastResult`
 *
 *  Lifecycle is debounced: 3-second activation threshold (must be static for
 *  ≥3 consecutive ticks) so micro-movements don't flap the radio.
 *  Disengagement is immediate on first motion / blur for safety.
 * ----------------------------------------------------------------
 */
import { useEffect, useRef, useState } from "react";
import { useNativeBridge, type RadioSuppressResult } from "@/hardware/useNativeBridge";

export interface AutoStealthState {
  active: boolean;
  engagedSince: number;          // ms timestamp, 0 = idle
  staticTicks: number;           // consecutive seconds of static phone
  lastResult: RadioSuppressResult | null;
  runtime: string;
}

const ACTIVATION_TICKS = 3;       // 3 s of static → engage

export function useAutoStealth(intentAutoEngaged: boolean): AutoStealthState {
  const bridge = useNativeBridge();
  const [state, setState] = useState<AutoStealthState>({
    active: false,
    engagedSince: 0,
    staticTicks: 0,
    lastResult: null,
    runtime: "browser",
  });

  const ticksRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (intentAutoEngaged) {
        ticksRef.current += 1;
      } else {
        ticksRef.current = 0;
      }
      const ticks = ticksRef.current;

      // Engage on rising edge after debounce
      if (!activeRef.current && ticks >= ACTIVATION_TICKS) {
        activeRef.current = true;
        try {
          const result = await bridge.suppressRadio();
          setState({
            active: true,
            engagedSince: Date.now(),
            staticTicks: ticks,
            lastResult: result,
            runtime: bridge.runtime,
          });
        } catch {
          /* ignore */
        }
        return;
      }

      // Disengage immediately on motion / blur
      if (activeRef.current && !intentAutoEngaged) {
        activeRef.current = false;
        await bridge.releaseRadio();
        setState({
          active: false,
          engagedSince: 0,
          staticTicks: 0,
          lastResult: null,
          runtime: bridge.runtime,
        });
        return;
      }

      // Same-state refresh
      setState((s) => ({ ...s, staticTicks: ticks, runtime: bridge.runtime }));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
      if (activeRef.current) bridge.releaseRadio().catch(() => {});
    };
  }, [intentAutoEngaged, bridge]);

  return state;
}
