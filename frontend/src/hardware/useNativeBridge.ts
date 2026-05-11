/**
 * useNativeBridge.ts
 * ----------------------------------------------------------------
 * Detects the runtime container BiOracle is executing inside and
 * exposes the strongest available "radio-suppress" primitive for
 * Universal Stealth.
 *
 *   • Capacitor (true native APK wrapper) → window.Capacitor.Plugins
 *   • TWA (Trusted Web Activity)          → document.referrer starts with "android-app://"
 *   • PWA standalone                      → matchMedia("(display-mode: standalone)")
 *   • Browser tab                         → fallback
 *
 * For each container we surface the BEST honest mitigation:
 *
 *   • Capacitor: calls @capacitor/network-status, @capacitor/screen-orientation
 *     and any registered "RadioSuppress" plugin (user can ship one).
 *   • TWA / PWA: requests Wake Lock (keeps screen alive without unlocking radio),
 *     aborts in-flight network via AbortController bus, instructs SW to bypass
 *     cache → no extra radio chatter, prompts user to flip airplane mode.
 *   • Browser tab: same as PWA minus wake-lock if API absent.
 *
 *   NOTE: NO web/PWA can DIRECTLY toggle the cellular/5G/Wi-Fi radio. That
 *         is a privileged Android system permission. The only true on-device
 *         radio shutdown is Airplane Mode, which the OS gates from any app.
 *         This bridge gives the strongest LEGITIMATE suppression layer.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useState } from "react";

export type RuntimeKind = "capacitor" | "twa" | "pwa" | "browser";

export interface NativeBridge {
  runtime: RuntimeKind;
  wakeLockSupported: boolean;
  hasCapacitor: boolean;
  hasRadioSuppressPlugin: boolean;
  /** Best-effort radio suppression. Returns object describing what actually fired. */
  suppressRadio: () => Promise<RadioSuppressResult>;
  releaseRadio: () => Promise<void>;
  /** Whether suppression is currently active */
  active: boolean;
}

export interface RadioSuppressResult {
  ranWakeLock: boolean;
  abortedRequests: number;
  pluginInvoked: boolean;
  airplaneModePromptShown: boolean;
  message: string;
}

// Shared AbortController bus the rest of the app can register fetch calls against.
const ABORT_BUS: AbortController[] = [];

export function registerAbortable(c: AbortController) {
  ABORT_BUS.push(c);
}

function detectRuntime(): RuntimeKind {
  if (typeof window === "undefined") return "browser";
  const w = window as any;
  if (w.Capacitor && typeof w.Capacitor.isNativePlatform === "function" && w.Capacitor.isNativePlatform()) {
    return "capacitor";
  }
  // TWA detection: Android Custom Tabs sets the referrer prefix
  if (typeof document !== "undefined" && document.referrer && document.referrer.startsWith("android-app://")) {
    return "twa";
  }
  if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) {
    return "pwa";
  }
  return "browser";
}

export function useNativeBridge(): NativeBridge {
  const [runtime] = useState<RuntimeKind>(() => detectRuntime());
  const [wakeLockRef, setWakeLockRef] = useState<any>(null);
  const [active, setActive] = useState(false);
  const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in (navigator as any);
  const hasCapacitor = typeof (window as any) !== "undefined" && !!(window as any).Capacitor;
  const hasRadioSuppressPlugin =
    hasCapacitor &&
    !!(window as any).Capacitor?.Plugins?.RadioSuppress;

  const suppressRadio = useCallback(async (): Promise<RadioSuppressResult> => {
    let ranWakeLock = false;
    let pluginInvoked = false;
    let abortedRequests = 0;
    let airplaneModePromptShown = false;
    let message = "";

    // 1. Wake-lock — keeps screen on without unlocking radio
    try {
      if (wakeLockSupported) {
        // @ts-ignore
        const wl = await navigator.wakeLock.request("screen");
        setWakeLockRef(wl);
        ranWakeLock = true;
      }
    } catch (_) { /* ok */ }

    // 2. Abort any in-flight registered fetches → no more chatter on the wire
    for (const c of ABORT_BUS) {
      try { c.abort(); abortedRequests++; } catch (_) { /* ok */ }
    }
    ABORT_BUS.length = 0;

    // 3. Capacitor: call user-registered RadioSuppress plugin if shipped
    if (hasRadioSuppressPlugin) {
      try {
        await (window as any).Capacitor.Plugins.RadioSuppress.engage();
        pluginInvoked = true;
      } catch (_) { /* ok */ }
    }

    // 4. PWA / TWA fallback: prompt user — only Airplane Mode actually kills the radio
    if (!pluginInvoked && runtime !== "capacitor") {
      airplaneModePromptShown = true;
    }

    setActive(true);
    message = pluginInvoked
      ? `Native RadioSuppress plugin engaged · wake-lock ${ranWakeLock ? "held" : "absent"} · ${abortedRequests} pings aborted`
      : `Suppressed app-side: wake-lock ${ranWakeLock ? "held" : "absent"} · ${abortedRequests} pings aborted · only Airplane Mode kills the modem`;

    return { ranWakeLock, abortedRequests, pluginInvoked, airplaneModePromptShown, message };
  }, [runtime, wakeLockSupported, hasRadioSuppressPlugin]);

  const releaseRadio = useCallback(async () => {
    try {
      if (wakeLockRef && typeof wakeLockRef.release === "function") {
        await wakeLockRef.release();
      }
    } catch (_) { /* ok */ }
    setWakeLockRef(null);
    if (hasRadioSuppressPlugin) {
      try { await (window as any).Capacitor.Plugins.RadioSuppress.release(); } catch (_) { /* ok */ }
    }
    setActive(false);
  }, [wakeLockRef, hasRadioSuppressPlugin]);

  useEffect(() => () => { if (wakeLockRef?.release) wakeLockRef.release().catch(() => {}); }, [wakeLockRef]);

  return {
    runtime,
    wakeLockSupported,
    hasCapacitor,
    hasRadioSuppressPlugin,
    suppressRadio,
    releaseRadio,
    active,
  };
}
