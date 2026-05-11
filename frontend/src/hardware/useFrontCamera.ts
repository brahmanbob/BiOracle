/**
 * useFrontCamera.ts
 * Single-shot capture from the user-facing camera for Retinol / Tongue scans.
 */
import { useCallback, useRef, useState } from "react";

export interface FrontCamState {
  active: boolean;
  permissionError: string | null;
  lastCaptureUrl: string | null;
}

export function useFrontCamera(videoRef: React.RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<FrontCamState>({
    active: false,
    permissionError: null,
    lastCaptureUrl: null,
  });
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState((s) => ({ ...s, active: true }));
    } catch (e: any) {
      setState((s) => ({ ...s, permissionError: e?.message || "Camera permission denied", active: false }));
    }
  }, [videoRef]);

  const capture = useCallback((): ImageData | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = Math.min(640, video.videoWidth);
    const h = Math.min(480, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const url = canvas.toDataURL("image/jpeg", 0.6);
    setState((s) => ({ ...s, lastCaptureUrl: url }));
    return ctx.getImageData(0, 0, w, h);
  }, [videoRef]);

  return { state, start, stop, capture };
}
