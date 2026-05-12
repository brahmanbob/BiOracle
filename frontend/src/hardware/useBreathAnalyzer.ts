/**
 * useBreathAnalyzer.ts
 * ----------------------------------------------------------------
 * S21 microphone → Breath Analysis dial.
 *
 *  Function:
 *    1. getUserMedia({ audio: { ec/ns/agc all OFF } })
 *    2. AnalyserNode @ fftSize 2048
 *    3. Sample mid-band RMS (300–2000 Hz) at ~50 Hz
 *    4. Adaptive baseline = rolling 30-sample mean during 1.5 s pre-roll
 *    5. Exhale onset  → RMS > baseline × 4 for ≥ 200 ms
 *       Exhale offset → RMS < peakRms × 0.5 for ≥ 400 ms
 *    6. duration = offset - onset (seconds)
 *       intensity = peakRms (0..1)
 *       evenness  = 1 − std(rms)/mean(rms) during the exhale plateau
 *
 *  Exposes:
 *    state.active, state.permissionError, state.sampleRate,
 *    state.phase: "calibrating" | "ready" | "exhaling" | "done",
 *    state.baselineRms, state.liveRms, state.peakRms,
 *    state.exhale: { duration, intensity, evenness, frames }
 *    state.analyser (for any external visualiser)
 *
 *  No UI here — pure sensor hook.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type BreathPhase = "calibrating" | "ready" | "exhaling" | "done";

export interface ExhaleEvent {
  duration: number;   // seconds
  intensity: number;  // peak RMS in 0..1
  evenness: number;   // 0..1 (1 = perfectly steady)
  frames: number;     // sample count captured during the exhale
  startedAt: number;  // performance.now()
  endedAt: number;
}

export interface BreathState {
  active: boolean;
  permissionError: string | null;
  sampleRate: number;
  fftSize: number;
  phase: BreathPhase;
  baselineRms: number;     // ambient floor from pre-roll
  liveRms: number;         // current frame mid-band RMS
  peakRms: number;         // max RMS observed during current/last exhale
  midBandHz: [number, number];
  exhale: ExhaleEvent | null;
  /** Raw envelope (last 200 samples) for any external visualiser */
  envelope: number[];
  analyser: AnalyserNode | null;
}

const SAMPLE_HZ = 50;
const PREROLL_SAMPLES = SAMPLE_HZ * 2; // 2 s calibration
const ONSET_TRIGGER_FACTOR = 4;        // RMS must exceed baseline × N
const ONSET_HOLD_MS = 200;
const OFFSET_DECAY_FACTOR = 0.5;       // back below peak × N
const OFFSET_HOLD_MS = 400;
const MIN_EXHALE_MS = 500;
const MAX_EXHALE_MS = 20_000;
const MID_BAND_LO = 300;
const MID_BAND_HI = 2000;

export function useBreathAnalyzer() {
  const [state, setState] = useState<BreathState>({
    active: false,
    permissionError: null,
    sampleRate: 0,
    fftSize: 2048,
    phase: "calibrating",
    baselineRms: 0,
    liveRms: 0,
    peakRms: 0,
    midBandHz: [MID_BAND_LO, MID_BAND_HI],
    exhale: null,
    envelope: [],
    analyser: null,
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const prerollBufRef = useRef<number[]>([]);
  const envelopeRef = useRef<number[]>([]);
  const baselineRef = useRef<number>(0);
  const phaseRef = useRef<BreathPhase>("calibrating");
  const exhaleSamplesRef = useRef<number[]>([]);
  const onsetTsRef = useRef<number>(0);
  const offsetCandidateTsRef = useRef<number>(0);
  const peakRef = useRef<number>(0);
  const aboveSinceRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    analyserRef.current = null;
    prerollBufRef.current = [];
    envelopeRef.current = [];
    exhaleSamplesRef.current = [];
    phaseRef.current = "calibrating";
    setState((s) => ({
      ...s,
      active: false,
      analyser: null,
      phase: "calibrating",
      baselineRms: 0,
      liveRms: 0,
      peakRms: 0,
      envelope: [],
    }));
  }, []);

  const reset = useCallback(() => {
    // Re-arm for another exhale without tearing down the audio context
    phaseRef.current = state.active ? "ready" : "calibrating";
    exhaleSamplesRef.current = [];
    peakRef.current = 0;
    aboveSinceRef.current = 0;
    offsetCandidateTsRef.current = 0;
    onsetTsRef.current = 0;
    setState((s) => ({ ...s, phase: phaseRef.current, peakRms: 0, exhale: null }));
  }, [state.active]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, permissionError: null, exhale: null, phase: "calibrating" }));
    prerollBufRef.current = [];
    envelopeRef.current = [];
    exhaleSamplesRef.current = [];
    phaseRef.current = "calibrating";
    peakRef.current = 0;
    aboveSinceRef.current = 0;
    onsetTsRef.current = 0;
    offsetCandidateTsRef.current = 0;
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
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;
      src.connect(analyser);
      analyserRef.current = analyser;

      setState((s) => ({
        ...s,
        active: true,
        sampleRate: ctx.sampleRate,
        fftSize: analyser.fftSize,
        analyser,
      }));

      timerRef.current = window.setInterval(() => {
        const an = analyserRef.current;
        const cx = ctxRef.current;
        if (!an || !cx) return;

        const freqBins = an.frequencyBinCount;
        const fd = new Float32Array(freqBins);
        an.getFloatFrequencyData(fd);
        const nyquist = cx.sampleRate / 2;
        const binHz = nyquist / freqBins;

        // Mid-band RMS (linearised from dB)
        let midEnergy = 0;
        let midBins = 0;
        for (let i = 1; i < freqBins; i++) {
          const hz = i * binHz;
          if (hz >= MID_BAND_LO && hz <= MID_BAND_HI) {
            const amp = Math.pow(10, fd[i] / 20);
            midEnergy += amp * amp;
            midBins++;
          }
        }
        const midRms = midBins > 0 ? Math.sqrt(midEnergy / midBins) : 0;

        envelopeRef.current.push(midRms);
        if (envelopeRef.current.length > 200) envelopeRef.current.shift();

        const now = performance.now();

        // --- Calibration phase ---
        if (phaseRef.current === "calibrating") {
          prerollBufRef.current.push(midRms);
          if (prerollBufRef.current.length >= PREROLL_SAMPLES) {
            const baseline =
              prerollBufRef.current.reduce((a, b) => a + b, 0) /
              prerollBufRef.current.length;
            baselineRef.current = Math.max(0.0001, baseline);
            phaseRef.current = "ready";
            setState((s) => ({ ...s, phase: "ready", baselineRms: round(baselineRef.current, 4), liveRms: round(midRms, 4), envelope: envelopeRef.current.slice() }));
          } else {
            setState((s) => ({ ...s, phase: "calibrating", liveRms: round(midRms, 4), envelope: envelopeRef.current.slice() }));
          }
          return;
        }

        // --- READY: look for onset ---
        if (phaseRef.current === "ready") {
          const threshold = baselineRef.current * ONSET_TRIGGER_FACTOR;
          if (midRms > threshold) {
            if (aboveSinceRef.current === 0) aboveSinceRef.current = now;
            if (now - aboveSinceRef.current >= ONSET_HOLD_MS) {
              phaseRef.current = "exhaling";
              onsetTsRef.current = aboveSinceRef.current;
              exhaleSamplesRef.current = [];
              peakRef.current = midRms;
              setState((s) => ({ ...s, phase: "exhaling", liveRms: round(midRms, 4), peakRms: round(midRms, 4) }));
              return;
            }
          } else {
            aboveSinceRef.current = 0;
          }
          setState((s) => ({ ...s, phase: "ready", liveRms: round(midRms, 4), envelope: envelopeRef.current.slice() }));
          return;
        }

        // --- EXHALING: track plateau + look for offset ---
        if (phaseRef.current === "exhaling") {
          exhaleSamplesRef.current.push(midRms);
          if (midRms > peakRef.current) peakRef.current = midRms;
          const offsetThreshold = peakRef.current * OFFSET_DECAY_FACTOR;
          const elapsed = now - onsetTsRef.current;

          if (midRms < offsetThreshold) {
            if (offsetCandidateTsRef.current === 0) offsetCandidateTsRef.current = now;
            if (
              now - offsetCandidateTsRef.current >= OFFSET_HOLD_MS &&
              elapsed >= MIN_EXHALE_MS
            ) {
              // Finalize exhale
              const samples = exhaleSamplesRef.current;
              const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
              const variance =
                samples.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, samples.length);
              const sd = Math.sqrt(variance);
              const evenness = mean > 0 ? Math.max(0, Math.min(1, 1 - sd / mean)) : 0;
              const intensity = Math.max(0, Math.min(1, peakRef.current));
              const duration = (now - onsetTsRef.current) / 1000;

              const exhale: ExhaleEvent = {
                duration: round(duration, 2),
                intensity: round(intensity, 3),
                evenness: round(evenness, 3),
                frames: samples.length,
                startedAt: onsetTsRef.current,
                endedAt: now,
              };
              phaseRef.current = "done";
              setState((s) => ({
                ...s,
                phase: "done",
                liveRms: round(midRms, 4),
                peakRms: round(peakRef.current, 4),
                exhale,
                envelope: envelopeRef.current.slice(),
              }));
              return;
            }
          } else {
            offsetCandidateTsRef.current = 0;
          }

          // Hard cap to prevent runaway exhale capture
          if (elapsed > MAX_EXHALE_MS) {
            phaseRef.current = "done";
            const samples = exhaleSamplesRef.current;
            const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
            const variance =
              samples.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, samples.length);
            const sd = Math.sqrt(variance);
            setState((s) => ({
              ...s,
              phase: "done",
              exhale: {
                duration: round(elapsed / 1000, 2),
                intensity: round(peakRef.current, 3),
                evenness: round(Math.max(0, Math.min(1, mean > 0 ? 1 - sd / mean : 0)), 3),
                frames: samples.length,
                startedAt: onsetTsRef.current,
                endedAt: now,
              },
            }));
            return;
          }

          setState((s) => ({
            ...s,
            phase: "exhaling",
            liveRms: round(midRms, 4),
            peakRms: round(peakRef.current, 4),
            envelope: envelopeRef.current.slice(),
          }));
        }
      }, 1000 / SAMPLE_HZ);
    } catch (e: any) {
      setState((s) => ({ ...s, permissionError: e?.message || "Microphone denied", active: false }));
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, reset };
}

function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
