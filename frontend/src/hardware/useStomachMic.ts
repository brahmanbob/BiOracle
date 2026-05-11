/**
 * useStomachMic.ts
 * ----------------------------------------------------------------
 * Live microphone capture → stomachAcousticAnalysis pipeline.
 *
 * Key additional metric (beyond SovereignLogic):
 *   • subSonicRatio — energy < 50 Hz / total energy.
 *     Lectin-induced inflammation manifests as low-frequency rumbling;
 *     healthy MMC (migrating motor complex) clicks live > 200 Hz.
 *   • lectinFrequencySignature = subSonicRatio × event-rate.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { stomachAcousticAnalysis, type StomachAcousticSignal } from "@/SovereignLogic";

export interface MicState {
  active: boolean;
  permissionError: string | null;
  sampleRate: number;
  rms: number;
  subSonicRatio: number;          // 0..1 — share of energy in <50Hz band
  lectinSignature: number;        // 0..1 — sub-sonic ratio × event-rate normalised
  acoustic: StomachAcousticSignal | null;
}

const ANALYSIS_INTERVAL_MS = 1800;
const FFT_SIZE = 2048;

export function useStomachMic() {
  const [state, setState] = useState<MicState>({
    active: false,
    permissionError: null,
    sampleRate: 0,
    rms: 0,
    subSonicRatio: 0,
    lectinSignature: 0,
    acoustic: null,
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      streamRef.current = stream;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.1;
      src.connect(analyser);
      analyserRef.current = analyser;

      setState((s) => ({ ...s, active: true, sampleRate: ctx.sampleRate }));

      timerRef.current = window.setInterval(() => {
        const an = analyserRef.current;
        const cx = ctxRef.current;
        if (!an || !cx) return;

        // Time-domain buffer for stomachAcousticAnalysis
        const td = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(td);
        const acoustic = stomachAcousticAnalysis({
          sampleRate: cx.sampleRate,
          samples: td,
          durationSec: an.fftSize / cx.sampleRate,
        });

        // Frequency-domain for sub-sonic ratio
        const freqBins = an.frequencyBinCount;
        const fd = new Float32Array(freqBins);
        an.getFloatFrequencyData(fd);
        const nyquist = cx.sampleRate / 2;
        const binHz = nyquist / freqBins;

        let subSonicEnergy = 0;
        let totalEnergy = 0;
        for (let i = 1; i < freqBins; i++) {
          const hz = i * binHz;
          // fd is in dB; convert to linear amplitude
          const amp = Math.pow(10, fd[i] / 20);
          totalEnergy += amp;
          if (hz < 50) subSonicEnergy += amp;
        }
        const subSonicRatio = totalEnergy > 0 ? subSonicEnergy / totalEnergy : 0;

        // RMS (time domain)
        let sq = 0;
        for (let i = 0; i < td.length; i++) sq += td[i] * td[i];
        const rms = Math.sqrt(sq / td.length);

        // Lectin signature: low-freq dominant + persistent rumble
        const eventNorm = Math.min(1, acoustic.bpm / 25);
        const lectinSignature = clamp01(subSonicRatio * 0.7 + eventNorm * 0.3);

        setState((s) => ({
          ...s,
          rms,
          subSonicRatio: round(subSonicRatio, 3),
          lectinSignature: round(lectinSignature, 3),
          acoustic,
        }));
      }, ANALYSIS_INTERVAL_MS);
    } catch (e: any) {
      setState((s) => ({
        ...s,
        permissionError: e?.message || "Microphone permission denied",
        active: false,
      }));
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
