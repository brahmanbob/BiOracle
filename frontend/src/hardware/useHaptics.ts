/**
 * useHaptics.ts
 * ----------------------------------------------------------------
 * Web wrapper around navigator.vibrate that mirrors the S21 native
 * Haptic Engine vocabulary. All methods are no-ops on browsers that
 * don't expose the Vibration API (desktop), so calling code stays
 * unconditional.
 *
 * Patterns are tuned for the Galaxy S21's linear actuator:
 *   • heavyClick   — Stealth-mode toggle / critical confirmations
 *   • thump        — one PPG beat (fires on each detected peak)
 *   • criticalBuzz — Lectin / Bleeding spike alert
 *   • sovereignChime — sovereign-override (longest pattern)
 *   • soft         — generic tap feedback
 * ----------------------------------------------------------------
 */
import { useCallback, useMemo, useRef } from "react";

export interface HapticAPI {
  supported: boolean;
  enabled: boolean;
  setEnabled: (b: boolean) => void;
  heavyClick: () => void;
  softTap: () => void;
  thump: () => void;
  criticalBuzz: () => void;
  sovereignChime: () => void;
  cancel: () => void;
}

export function useHaptics(initialEnabled = true): HapticAPI {
  const supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const enabledRef = useRef(initialEnabled);

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!supported || !enabledRef.current) return;
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    },
    [supported],
  );

  const api = useMemo<HapticAPI>(
    () => ({
      supported,
      get enabled() {
        return enabledRef.current;
      },
      setEnabled: (b: boolean) => {
        enabledRef.current = b;
        if (!b && supported) navigator.vibrate(0);
      },
      heavyClick: () => vibrate([90, 35, 140]),
      softTap: () => vibrate(20),
      thump: () => vibrate(28),
      criticalBuzz: () => vibrate([180, 70, 180, 70, 320]),
      sovereignChime: () => vibrate([240, 60, 60, 60, 240, 60, 60, 60, 520]),
      cancel: () => supported && navigator.vibrate(0),
    }),
    [supported, vibrate],
  );

  return api;
}
