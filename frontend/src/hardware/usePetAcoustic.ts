/**
 * usePetAcoustic.ts
 * ----------------------------------------------------------------
 * Bio-Pet acoustic triage.
 *  Calibrates the microphone analyser for canine / feline frequency bands:
 *
 *    • Canine bloat / whine band : 200–700 Hz sustained low rumble
 *    • Feline distress band      : 700–1500 Hz yowling / high purrs broken
 *    • Sub-rumble (bloat marker) : 30–150 Hz  — abdominal distension
 *    • Vocal silence ratio       : 1 − activeFrames / totalFrames
 *
 * Returns a stress score 0..1 and a band-by-band breakdown.
 * Designed to read the caregiver, never bark at them.
 * ----------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PetSpecies = "dog" | "cat";

export interface PetAcousticState {
  active: boolean;
  permissionError: string | null;
  species: PetSpecies;
  subRumble: number;      // 0..1 — abdominal rumble share (noise-corrected)
  vocalBand: number;      // 0..1 — species-specific vocal energy (noise-corrected)
  silenceRatio: number;   // 0..1 — share of silent frames
  stressScore: number;    // 0..1 — fused triage score
  state: "calm" | "watch" | "distress";
  sampleRate: number;
  analyser: AnalyserNode | null;
  /** Calibration phase status */
  calibration: {
    phase: "idle" | "calibrating" | "ready";
    elapsedSec: number;
    noiseFloorRms: number;
    noiseFloorVocal: number;
    noiseFloorRumble: number;
  };
}

const ANALYSIS_INTERVAL_MS = 1600;
const FFT_SIZE = 2048;
const NOISE_FLOOR_SEC = 3;   // 3-second silent check before scoring

const VOCAL_BANDS: Record<PetSpecies, [number, number]> = {
  dog: [200, 700],
  cat: [700, 1500],
};

const SUB_RUMBLE_BAND: [number, number] = [30, 150];

export function usePetAcoustic(initialSpecies: PetSpecies = "dog") {
  const [state, setState] = useState<PetAcousticState>({
    active: false,
    permissionError: null,
    species: initialSpecies,
    subRumble: 0,
    vocalBand: 0,
    silenceRatio: 1,
    stressScore: 0,
    state: "calm",
    sampleRate: 0,
    analyser: null,
    calibration: { phase: "idle", elapsedSec: 0, noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0 },
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const speciesRef = useRef<PetSpecies>(initialSpecies);
  const silenceWinRef = useRef<number[]>([]);
  const calibrationRef = useRef<{
    phase: "idle" | "calibrating" | "ready";
    startTs: number;
    rmsSamples: number[];
    vocalSamples: number[];
    rumbleSamples: number[];
    noiseFloorRms: number;
    noiseFloorVocal: number;
    noiseFloorRumble: number;
  }>({
    phase: "idle", startTs: 0,
    rmsSamples: [], vocalSamples: [], rumbleSamples: [],
    noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0,
  });

  const setSpecies = (s: PetSpecies) => {
    speciesRef.current = s;
    setState((st) => ({ ...st, species: s }));
  };

  const stop = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    analyserRef.current = null;
    silenceWinRef.current = [];
    calibrationRef.current = {
      phase: "idle", startTs: 0,
      rmsSamples: [], vocalSamples: [], rumbleSamples: [],
      noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0,
    };
    setState((s) => ({
      ...s,
      active: false,
      analyser: null,
      calibration: { phase: "idle", elapsedSec: 0, noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0 },
    }));
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
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);
      analyserRef.current = analyser;

      // Enter calibration phase
      calibrationRef.current = {
        phase: "calibrating", startTs: Date.now(),
        rmsSamples: [], vocalSamples: [], rumbleSamples: [],
        noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0,
      };

      setState((s) => ({
        ...s,
        active: true,
        sampleRate: ctx.sampleRate,
        analyser,
        calibration: { phase: "calibrating", elapsedSec: 0, noiseFloorRms: 0, noiseFloorVocal: 0, noiseFloorRumble: 0 },
      }));

      timerRef.current = window.setInterval(() => {
        const an = analyserRef.current;
        const cx = ctxRef.current;
        if (!an || !cx) return;

        const freqBins = an.frequencyBinCount;
        const fd = new Float32Array(freqBins);
        an.getFloatFrequencyData(fd);
        const td = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(td);

        // RMS
        let sq = 0;
        for (let i = 0; i < td.length; i++) sq += td[i] * td[i];
        const rms = Math.sqrt(sq / td.length);

        const nyquist = cx.sampleRate / 2;
        const binHz = nyquist / freqBins;
        const sp = speciesRef.current;
        const [vLo, vHi] = VOCAL_BANDS[sp];
        const [sLo, sHi] = SUB_RUMBLE_BAND;

        let vocalEnergy = 0, subEnergy = 0, totalEnergy = 0;
        for (let i = 1; i < freqBins; i++) {
          const hz = i * binHz;
          const amp = Math.pow(10, fd[i] / 20);
          totalEnergy += amp;
          if (hz >= vLo && hz <= vHi) vocalEnergy += amp;
          if (hz >= sLo && hz <= sHi) subEnergy += amp;
        }
        const vocalBandRaw = totalEnergy > 0 ? vocalEnergy / totalEnergy : 0;
        const subRumbleRaw = totalEnergy > 0 ? subEnergy / totalEnergy : 0;

        // ----- Calibration phase: collect 3s baseline -----
        const cal = calibrationRef.current;
        if (cal.phase === "calibrating") {
          cal.rmsSamples.push(rms);
          cal.vocalSamples.push(vocalBandRaw);
          cal.rumbleSamples.push(subRumbleRaw);
          const elapsed = (Date.now() - cal.startTs) / 1000;
          if (elapsed >= NOISE_FLOOR_SEC) {
            cal.noiseFloorRms = mean(cal.rmsSamples);
            cal.noiseFloorVocal = mean(cal.vocalSamples);
            cal.noiseFloorRumble = mean(cal.rumbleSamples);
            cal.phase = "ready";
            setState((s) => ({
              ...s,
              calibration: {
                phase: "ready",
                elapsedSec: round(elapsed, 1),
                noiseFloorRms: round(cal.noiseFloorRms, 4),
                noiseFloorVocal: round(cal.noiseFloorVocal, 3),
                noiseFloorRumble: round(cal.noiseFloorRumble, 3),
              },
            }));
          } else {
            setState((s) => ({
              ...s,
              calibration: { ...s.calibration, phase: "calibrating", elapsedSec: round(elapsed, 1) },
            }));
          }
          return; // skip scoring while calibrating
        }

        // ----- Live scoring with noise-floor subtraction -----
        const vocalBand = clamp01(vocalBandRaw - cal.noiseFloorVocal);
        const subRumble = clamp01(subRumbleRaw - cal.noiseFloorRumble);

        // Silence: corrected against noise floor RMS
        const silenceThreshold = Math.max(0.012, cal.noiseFloorRms * 1.4);
        silenceWinRef.current.push(rms < silenceThreshold ? 1 : 0);
        if (silenceWinRef.current.length > 30) silenceWinRef.current.shift();
        const silenceRatio =
          silenceWinRef.current.reduce((a, b) => a + b, 0) /
          Math.max(1, silenceWinRef.current.length);

        const activityFactor = 1 - silenceRatio;
        const stressScore = clamp01(
          (vocalBand * 0.55 + subRumble * 0.45) * activityFactor,
        );
        const tier: PetAcousticState["state"] =
          stressScore > 0.55 ? "distress" : stressScore > 0.3 ? "watch" : "calm";

        setState((s) => ({
          ...s,
          subRumble: round(subRumble, 3),
          vocalBand: round(vocalBand, 3),
          silenceRatio: round(silenceRatio, 3),
          stressScore: round(stressScore, 3),
          state: tier,
        }));
      }, ANALYSIS_INTERVAL_MS);
    } catch (e: any) {
      setState((s) => ({ ...s, permissionError: e?.message || "Microphone denied", active: false }));
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, setSpecies };
}

function clamp01(x: number) { return Number.isNaN(x) ? 0 : Math.max(0, Math.min(1, x)); }
function round(x: number, dp: number) { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
function mean(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
