/**
 * useAmbientLight.ts
 * ----------------------------------------------------------------
 * Sovereign ambient-light sensor.
 *  1. AmbientLightSensor API (Chromium / S21) when exposed
 *  2. Fallback: sampling the front camera 8×8 px frame brightness
 *     (only enabled when the caller flips `enableCameraFallback`)
 *
 * Returns a calibrated 0..1 brightness value and a `isLowLight`
 * flag (lux < 8 → crib / bedroom darkness).
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface AmbientLightState {
  available: boolean;
  active: boolean;
  lux: number;          // sensor estimate
  brightness: number;   // 0..1 normalised
  isLowLight: boolean;  // lux < 8 (crib / bedroom)
  permissionError: string | null;
  source: "sensor" | "camera" | "none";
}

const LOW_LIGHT_LUX = 8;

export function useAmbientLight(enableCameraFallback = false) {
  const [state, setState] = useState<AmbientLightState>({
    available: typeof window !== "undefined" && "AmbientLightSensor" in window,
    active: false,
    lux: 0,
    brightness: 0,
    isLowLight: false,
    permissionError: null,
    source: "none",
  });

  const sensorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (sensorRef.current) {
      try { sensorRef.current.stop(); } catch { /* ignore */ }
      sensorRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null }));

    // 1. Native AmbientLightSensor
    if (typeof window !== "undefined" && "AmbientLightSensor" in window) {
      try {
        // @ts-ignore — non-standard
        const sensor = new window.AmbientLightSensor({ frequency: 2 });
        sensor.onreading = () => {
          const lux: number = sensor.illuminance ?? 0;
          const brightness = Math.max(0, Math.min(1, lux / 400));
          setState((s) => ({
            ...s,
            active: true,
            lux,
            brightness,
            isLowLight: lux < LOW_LIGHT_LUX,
            source: "sensor",
          }));
        };
        sensor.onerror = (e: any) => {
          setState((s) => ({ ...s, permissionError: e?.error?.message || "AmbientLight sensor error" }));
        };
        sensor.start();
        sensorRef.current = sensor;
        setState((s) => ({ ...s, active: true, source: "sensor" }));
        return;
      } catch (e: any) {
        // fall through to camera fallback if enabled
        setState((s) => ({ ...s, permissionError: e?.message || "AmbientLight sensor unavailable" }));
      }
    }

    if (!enableCameraFallback) return;

    // 2. Camera fallback (sample 8×8 luma)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 64 }, height: { ideal: 64 } },
        audio: false,
      });
      streamRef.current = stream;
      const vid = document.createElement("video");
      vid.srcObject = stream;
      vid.muted = true;
      vid.playsInline = true;
      await vid.play().catch(() => {});
      videoRef.current = vid;

      const canvas = document.createElement("canvas");
      canvas.width = 8; canvas.height = 8;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      timerRef.current = window.setInterval(() => {
        if (!videoRef.current) return;
        try {
          ctx.drawImage(videoRef.current, 0, 0, 8, 8);
          const data = ctx.getImageData(0, 0, 8, 8).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            // Rec.601 luma
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          const avg = sum / (data.length / 4);     // 0..255
          const brightness = avg / 255;            // 0..1
          const lux = brightness * 400;            // rough scale
          setState((s) => ({
            ...s,
            active: true,
            lux,
            brightness,
            isLowLight: lux < LOW_LIGHT_LUX,
            source: "camera",
          }));
        } catch { /* ignore frame errors */ }
      }, 1500);
    } catch (e: any) {
      setState((s) => ({ ...s, permissionError: e?.message || "Camera permission denied", active: false }));
    }
  }, [enableCameraFallback]);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop };
}
