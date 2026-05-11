/**
 * useRespiration.ts
 * ----------------------------------------------------------------
 * Rhythmic Respiration Tracking — Bio-Baby module.
 *
 *  Strategy:
 *    1. AnalyserNode RMS sampled at ~20 Hz → respiration envelope
 *    2. Rolling 30 s envelope window, peak-pick on smoothed signal
 *    3. Breath rate = 60 / mean(peak-to-peak interval)
 *    4. Rhythm score = 1 − normalised variance of peak intervals
 *
 *  Sovereign safety: any sustained silence > 14 s OR rate drift
 *  > 35 % flips `apneaSuspect`. We surface — we never alarm.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface RespirationState {
  active: boolean;
  permissionError: string | null;
  breathRate: number;     // breaths per minute
  rhythm: number;         // 0..1 (1 = very even)
  envelope: number[];     // last 90 envelope samples for sparkline
  apneaSuspect: boolean;
  silenceSec: number;
  state: "settling" | "rhythmic" | "irregular" | "watch";
  analyser: AnalyserNode | null;
}

const SAMPLE_HZ = 20;
const ENV_LEN = SAMPLE_HZ * 30;  // 30 s envelope
const PEAK_THRESHOLD = 0.018;
const APNEA_SILENCE_SEC = 14;

export function useRespiration() {
  const [state, setState] = useState<RespirationState>({
    active: false,
    permissionError: null,
    breathRate: 0,
    rhythm: 0,
    envelope: [],
    apneaSuspect: false,
    silenceSec: 0,
    state: "settling",
    analyser: null,
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const envRef = useRef<number[]>([]);
  const peaksRef = useRef<number[]>([]); // peak indices

  const stop = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    analyserRef.current = null;
    envRef.current = [];
    peaksRef.current = [];
    setState((s) => ({ ...s, active: false, analyser: null }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      streamRef.current = stream;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.3;
      src.connect(analyser);
      analyserRef.current = analyser;
      setState((s) => ({ ...s, active: true, analyser }));

      let frameIdx = 0;
      let lastNonSilent = Date.now();
      timerRef.current = window.setInterval(() => {
        const an = analyserRef.current;
        if (!an) return;
        const td = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(td);
        // RMS as envelope sample
        let sq = 0;
        for (let i = 0; i < td.length; i++) sq += td[i] * td[i];
        const rms = Math.sqrt(sq / td.length);

        envRef.current.push(rms);
        if (envRef.current.length > ENV_LEN) envRef.current.shift();

        // smoothing (boxcar n=5)
        const env = envRef.current;
        const smoothed = env.map((_, i) => {
          const lo = Math.max(0, i - 2);
          const hi = Math.min(env.length - 1, i + 2);
          let s = 0; let n = 0;
          for (let j = lo; j <= hi; j++) { s += env[j]; n++; }
          return s / n;
        });

        // simple peak picking
        const peaks: number[] = [];
        for (let i = 2; i < smoothed.length - 2; i++) {
          const v = smoothed[i];
          if (
            v > PEAK_THRESHOLD &&
            v > smoothed[i - 1] && v > smoothed[i - 2] &&
            v > smoothed[i + 1] && v > smoothed[i + 2]
          ) {
            peaks.push(i);
          }
        }
        peaksRef.current = peaks;

        // breath rate
        let breathRate = 0;
        let rhythm = 0;
        if (peaks.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);
          const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          breathRate = (60 * SAMPLE_HZ) / Math.max(1, meanInt);
          const variance =
            intervals.reduce((a, b) => a + (b - meanInt) ** 2, 0) / intervals.length;
          const sd = Math.sqrt(variance);
          rhythm = Math.max(0, Math.min(1, 1 - sd / meanInt));
        }

        // silence / apnea suspect
        if (rms > 0.005) lastNonSilent = Date.now();
        const silenceSec = (Date.now() - lastNonSilent) / 1000;
        const apneaSuspect = silenceSec > APNEA_SILENCE_SEC && env.length > SAMPLE_HZ * 5;

        let tier: RespirationState["state"] = "settling";
        if (env.length >= SAMPLE_HZ * 8) {
          if (apneaSuspect) tier = "watch";
          else if (rhythm > 0.7 && breathRate > 8 && breathRate < 65) tier = "rhythmic";
          else if (rhythm < 0.4 || breathRate < 6 || breathRate > 80) tier = "irregular";
          else tier = "rhythmic";
        }

        frameIdx++;
        setState((s) => ({
          ...s,
          breathRate: round(breathRate, 1),
          rhythm: round(rhythm, 3),
          envelope: smoothed.slice(-90),
          apneaSuspect,
          silenceSec: round(silenceSec, 1),
          state: tier,
        }));
      }, 1000 / SAMPLE_HZ);
    } catch (e: any) {
      setState((s) => ({ ...s, permissionError: e?.message || "Microphone denied", active: false }));
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop };
}

function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
