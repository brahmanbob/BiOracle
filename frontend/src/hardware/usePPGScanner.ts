/**
 * usePPGScanner.ts
 * ----------------------------------------------------------------
 * S21 rear-camera + flash PPG scanner.
 *
 * Pipeline:
 *   1. getUserMedia { facingMode: 'environment' } → MediaStream
 *   2. ImageCapture.applyConstraints({ advanced: [{ torch: true }] })
 *   3. Draw frame to 32×32 canvas at ~30Hz, average RED channel
 *   4. Detrend (subtract sliding mean) → 1D PPG signal
 *   5. Peak-pick on derivative zero-crossings → beat intervals
 *   6. HR = 60 / mean(intervals); HRV = std(intervals)
 *   7. Asymmetry = clamp01( 0.6 * HRV_norm + 0.4 * (1 - SNR_norm) )
 *      → high HRV + low signal-to-noise = hemorrhage suspect.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface PPGSample {
  t: number;
  red: number;
}

export interface PPGResult {
  heartRate: number;       // bpm
  hrv: number;             // std of inter-beat-interval (ms)
  signalAmplitude: number; // peak-to-trough of normalised signal (0..1)
  asymmetry: number;       // 0..1, fed into SovereignLogic
  hemorrhageSuspect: boolean;
  rationale: string;
}

export interface PPGState {
  active: boolean;
  permissionError: string | null;
  torchSupported: boolean;
  fps: number;
  liveHeartRate: number;
  liveAmplitude: number;
  liveSignal: number[];   // last ~150 samples for sparkline
  /** ms timestamp of most recent detected peak (Date.now()) */
  lastBeatTs: number;
  /** raw samples (red - 0.5*green) buffer for APG / vascular age analysis */
  rawSamples: number[];
  /** Effective sample rate Hz */
  sampleRate: number;
  lastResult: PPGResult | null;
  elapsedSec: number;
}

const SAMPLE_WIN_SEC = 12;     // analysis window
const TARGET_FPS = 30;
const MAX_SAMPLES = SAMPLE_WIN_SEC * TARGET_FPS;

export function usePPGScanner(
  videoRef: React.RefObject<HTMLVideoElement>,
  onBeat?: () => void,
) {
  const [state, setState] = useState<PPGState>({
    active: false,
    permissionError: null,
    torchSupported: false,
    fps: 0,
    liveHeartRate: 0,
    liveAmplitude: 0,
    liveSignal: [],
    lastBeatTs: 0,
    rawSamples: [],
    sampleRate: 30,
    lastResult: null,
    elapsedSec: 0,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const samplesRef = useRef<PPGSample[]>([]);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameTsRef = useRef<number>(0);
  const startTsRef = useRef<number>(0);
  const lastPeakIndexRef = useRef<number>(-1);
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (trackRef.current) {
      try {
        // turn off torch
        // @ts-ignore
        trackRef.current.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      } catch (_) { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    trackRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null, lastResult: null, liveSignal: [] }));
    samplesRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: TARGET_FPS, max: TARGET_FPS },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Torch
      let torchSupported = false;
      try {
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        if (caps && caps.torch) {
          // @ts-ignore — torch is in advanced constraints but not in TS lib yet
          await track.applyConstraints({ advanced: [{ torch: true }] });
          torchSupported = true;
        }
      } catch (e) {
        // Torch failed but scan still works on the back-camera light reflection / finger PPG
        // (user places fingertip over the lens)
        torchSupported = false;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.width = 32;
        canvasRef.current.height = 32;
      }

      startTsRef.current = performance.now();
      lastFrameTsRef.current = startTsRef.current;
      setState((s) => ({
        ...s,
        active: true,
        torchSupported,
        elapsedSec: 0,
        fps: 0,
        liveHeartRate: 0,
        liveAmplitude: 0,
      }));

      const tick = () => {
        if (!trackRef.current) return;
        const now = performance.now();
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = img.data;
            let r = 0, g = 0, b = 0;
            const count = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            r /= count; g /= count; b /= count;
            // PPG signal: red dominates blood-volume changes, subtract green to suppress motion bias
            const ppg = r - g * 0.5;
            samplesRef.current.push({ t: now, red: ppg });
            if (samplesRef.current.length > MAX_SAMPLES) samplesRef.current.shift();
          }
        }

        const dt = now - lastFrameTsRef.current;
        lastFrameTsRef.current = now;
        const fps = dt > 0 ? 1000 / dt : 0;
        const elapsed = (now - startTsRef.current) / 1000;

        // Live analysis every ~10 frames once we have ≥3s of data
        if (samplesRef.current.length > TARGET_FPS * 3 && samplesRef.current.length % 8 === 0) {
          const live = analysePPG(samplesRef.current);
          // Beat detection: if the live result reports a heart rate and the
          // newest peak is past our previous index, fire onBeat (for haptics).
          const newPeakIdx = samplesRef.current.length - 1;
          // Heuristic: live signal slope flipped negative in last 2 samples
          const arr = samplesRef.current;
          const a = arr[arr.length - 3]?.red ?? 0;
          const b = arr[arr.length - 2]?.red ?? 0;
          const c = arr[arr.length - 1]?.red ?? 0;
          if (b > a && b > c && newPeakIdx - lastPeakIndexRef.current > Math.round(TARGET_FPS * 0.35) && live.heartRate > 30) {
            lastPeakIndexRef.current = newPeakIdx;
            if (onBeatRef.current) onBeatRef.current();
            setState((s) => ({
              ...s,
              fps,
              elapsedSec: elapsed,
              liveHeartRate: live.heartRate,
              liveAmplitude: live.signalAmplitude,
              liveSignal: samplesRef.current.slice(-150).map((p) => p.red),
              lastBeatTs: Date.now(),
              rawSamples: samplesRef.current.map((p) => p.red),
              sampleRate: fps,
            }));
          } else {
            setState((s) => ({
              ...s,
              fps,
              elapsedSec: elapsed,
              liveHeartRate: live.heartRate,
              liveAmplitude: live.signalAmplitude,
              liveSignal: samplesRef.current.slice(-150).map((p) => p.red),
              rawSamples: samplesRef.current.map((p) => p.red),
              sampleRate: fps,
            }));
          }
        } else {
          setState((s) => ({
            ...s,
            fps,
            elapsedSec: elapsed,
            liveSignal: samplesRef.current.slice(-150).map((p) => p.red),
          }));
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setState((s) => ({
        ...s,
        permissionError: e?.message || "Camera permission denied",
        active: false,
      }));
    }
  }, [videoRef]);

  const finalize = useCallback((): PPGResult | null => {
    if (samplesRef.current.length < TARGET_FPS * 3) return null;
    const result = analysePPG(samplesRef.current);
    setState((s) => ({ ...s, lastResult: result }));
    return result;
  }, []);

  // cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, finalize };
}

// ----------------------------------------------------------------
// PPG analysis (pure)
// ----------------------------------------------------------------
export function analysePPG(raw: PPGSample[]): PPGResult {
  if (raw.length < 30) {
    return emptyResult("insufficient samples");
  }

  // Compute actual sample rate
  const dur = (raw[raw.length - 1].t - raw[0].t) / 1000;
  const fs = raw.length / Math.max(0.001, dur);

  // 1. detrend (subtract sliding mean over ~1s)
  const win = Math.max(5, Math.round(fs));
  const sig: number[] = new Array(raw.length).fill(0);
  let sum = 0;
  for (let i = 0; i < raw.length; i++) {
    sum += raw[i].red;
    if (i >= win) sum -= raw[i - win].red;
    const mean = sum / Math.min(i + 1, win);
    sig[i] = raw[i].red - mean;
  }

  // 2. normalise to amplitude proxy
  let min = Infinity, max = -Infinity;
  for (const v of sig) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const peakToTrough = max - min;
  // For typical PPG with torch, peakToTrough should be 1.5+ (8-bit red-channel units).
  // Normalise via tanh so we get 0..1.
  const signalAmplitude = Math.tanh(peakToTrough / 6);

  // 3. peak detection: positive zero crossings of derivative with refractory period
  const refractoryFrames = Math.round(fs * 0.35); // 350ms → max ~170 bpm
  const peaks: number[] = [];
  for (let i = 2; i < sig.length - 2; i++) {
    if (
      sig[i] > sig[i - 1] &&
      sig[i] > sig[i + 1] &&
      sig[i] > sig[i - 2] * 1.05 &&
      sig[i] > sig[i + 2] * 1.05 &&
      sig[i] > (max - min) * 0.15
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= refractoryFrames) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 3) {
    return {
      heartRate: 0,
      hrv: 0,
      signalAmplitude,
      asymmetry: clamp01(0.7 + (1 - signalAmplitude) * 0.3), // weak signal → still suspect
      hemorrhageSuspect: true,
      rationale: `Insufficient peaks detected (${peaks.length}). Signal amplitude=${signalAmplitude.toFixed(2)} — likely poor coupling or low perfusion.`,
    };
  }

  // 4. inter-beat intervals (ms)
  const ibi: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ms = ((peaks[i] - peaks[i - 1]) / fs) * 1000;
    if (ms > 280 && ms < 2000) ibi.push(ms);
  }
  if (ibi.length === 0) return emptyResult("no valid intervals");

  const meanIbi = ibi.reduce((a, b) => a + b, 0) / ibi.length;
  const varIbi = ibi.reduce((a, b) => a + (b - meanIbi) ** 2, 0) / ibi.length;
  const hrv = Math.sqrt(varIbi); // ms SDNN proxy
  const heartRate = 60000 / meanIbi;

  // 5. asymmetry score: high HRV (>120ms) + low amplitude (<0.35) = hemorrhage suspect
  const hrvNorm = clamp01(hrv / 180);
  const lowSnr = clamp01(1 - signalAmplitude);
  const asymmetry = clamp01(hrvNorm * 0.6 + lowSnr * 0.4);
  const hemorrhageSuspect = asymmetry >= 0.7 || (hrv > 140 && signalAmplitude < 0.3);

  return {
    heartRate: Math.round(heartRate * 10) / 10,
    hrv: Math.round(hrv * 10) / 10,
    signalAmplitude: Math.round(signalAmplitude * 1000) / 1000,
    asymmetry: Math.round(asymmetry * 1000) / 1000,
    hemorrhageSuspect,
    rationale: `HR=${heartRate.toFixed(1)}bpm · HRV(SDNN)=${hrv.toFixed(1)}ms · amp=${signalAmplitude.toFixed(2)} · fs=${fs.toFixed(1)}Hz · ${peaks.length} peaks in ${dur.toFixed(1)}s.`,
  };
}

function emptyResult(why: string): PPGResult {
  return {
    heartRate: 0,
    hrv: 0,
    signalAmplitude: 0,
    asymmetry: 0,
    hemorrhageSuspect: false,
    rationale: why,
  };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
