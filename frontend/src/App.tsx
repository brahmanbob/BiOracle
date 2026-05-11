import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "@/styles/bioracle.css";
import HealthBattery from "@/components/HealthBattery";
import TriageDashboard from "@/components/TriageDashboard";
import {
  emergencyTriage,
  fingerprintToABO,
  type ABOEstimate,
  type TriageVerdict,
} from "@/SovereignLogic";
import { usePPGScanner } from "@/hardware/usePPGScanner";
import { useStomachMic } from "@/hardware/useStomachMic";
import { useMagnetometer } from "@/hardware/useMagnetometer";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
const API = `${BACKEND_URL}/api`;

const DEFAULT_BLOOD: ABOEstimate = fingerprintToABO({
  ridgeDensity: 12.5,
  whorlRatio: 0.4,
  loopRatio: 0.4,
  archRatio: 0.2,
  minutiaeIndex: 0.55,
});

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ppg = usePPGScanner(videoRef);
  const mic = useStomachMic();
  const mag = useMagnetometer();

  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [lastLedgerId, setLastLedgerId] = useState<string | null>(null);

  // Derived sensor → triage inputs
  const lectin = mic.state.lectinSignature;
  const vascular = ppg.state.lastResult?.asymmetry ?? (ppg.state.liveAmplitude > 0 ? Math.max(0, Math.min(1, (1 - ppg.state.liveAmplitude) * 0.6)) : 0);
  const emf = mag.state.emfIndex;
  const heartRate = ppg.state.lastResult?.heartRate || ppg.state.liveHeartRate || 0;

  const verdict: TriageVerdict = useMemo(
    () =>
      emergencyTriage({
        lectin,
        vascularAsymmetry: vascular,
        emf,
        acoustic: mic.state.acoustic ?? undefined,
        heartRate: heartRate || undefined,
        blood: DEFAULT_BLOOD,
      }),
    [lectin, vascular, emf, mic.state.acoustic, heartRate],
  );

  const charge = useMemo(() => Math.max(4, 100 - verdict.score), [verdict.score]);
  const severity = verdict.level as
    | "stable"
    | "monitor"
    | "elevated"
    | "critical"
    | "sovereign-override";

  // Backend handshake
  useEffect(() => {
    axios
      .get(`${API}/`)
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  // Auto-finalize PPG result after 12s of capture
  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 12 && !ppg.state.lastResult) {
      ppg.finalize();
    }
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  const commitToLedger = async () => {
    try {
      const payload = {
        lectin,
        vascular_asymmetry: vascular,
        emf,
        heart_rate: heartRate,
        acoustic: mic.state.acoustic
          ? {
              state: mic.state.acoustic.state,
              bpm: mic.state.acoustic.bpm,
              spectral_centroid: mic.state.acoustic.spectralCentroid,
              irritation_index: mic.state.acoustic.irritationIndex,
            }
          : null,
        blood: DEFAULT_BLOOD,
        verdict,
        raw: {
          ppg: ppg.state.lastResult,
          mag: {
            microtesla: mag.state.microtesla,
            baseline: mag.state.baseline,
            spikes: mag.state.spikes,
            synthetic: mag.state.syntheticInterference,
          },
          mic: {
            sub_sonic_ratio: mic.state.subSonicRatio,
            lectin_signature: mic.state.lectinSignature,
            sample_rate: mic.state.sampleRate,
          },
        },
      };
      const res = await axios.post(`${API}/triage/scan`, payload);
      setLastLedgerId(res.data?.id ?? null);
    } catch (e) {
      console.error("Ledger write failed", e);
    }
  };

  const startAll = async () => {
    await ppg.start();
    await mic.start();
    if (mag.state.available) await mag.start();
  };

  const stopAll = () => {
    ppg.stop();
    mic.stop();
    mag.stop();
  };

  return (
    <div className="bo-app" data-testid="bioracle-root">
      <header className="bo-header">
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">Sovereign Triage</h1>
        <span className="tagline">
          Crack #2 · Sensors · {backendOk === null ? "linking ledger…" : backendOk ? "ledger online" : "ledger offline"}
          {ppg.state.active && " · PPG live"}
          {mic.state.active && " · mic live"}
          {mag.state.active && ` · mag ${mag.state.microtesla.toFixed(1)}µT`}
        </span>
      </header>

      <HealthBattery
        charge={charge}
        heartRate={heartRate}
        severity={severity}
        ppgAmplitude={ppg.state.liveAmplitude}
        syntheticInterference={mag.state.syntheticInterference}
        emfMicrotesla={mag.state.microtesla}
      />

      <div className="bo-battery-state" data-testid="battery-state-label">
        {verdict.level === "sovereign-override"
          ? "SOVEREIGN OVERRIDE"
          : verdict.level === "critical"
          ? "CRITICAL"
          : verdict.level === "elevated"
          ? "ELEVATED"
          : verdict.level === "monitor"
          ? "MONITOR"
          : "STABLE"}
      </div>

      {/* Hidden video element — required for the PPG canvas pipeline */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        data-testid="ppg-video"
      />

      <div className="bo-controls">
        <button
          className="bo-btn"
          onClick={startAll}
          disabled={ppg.state.active || mic.state.active}
          data-testid="btn-start-all"
        >
          Run Full Scan
        </button>
        <button
          className="bo-btn ghost"
          onClick={stopAll}
          disabled={!ppg.state.active && !mic.state.active && !mag.state.active}
          data-testid="btn-stop-all"
        >
          Stop All Sensors
        </button>
        <button
          className="bo-btn ghost"
          onClick={commitToLedger}
          disabled={backendOk !== true}
          data-testid="btn-commit-ledger"
        >
          Commit to Ledger
        </button>
        {lastLedgerId && (
          <span
            className="bo-mono bo-gold"
            data-testid="ledger-id"
            style={{ fontSize: 11, letterSpacing: "0.2em", alignSelf: "center" }}
          >
            LEDGER · {lastLedgerId.slice(0, 8).toUpperCase()}
          </span>
        )}
      </div>

      <TriageDashboard
        ppgActive={ppg.state.active}
        ppgError={ppg.state.permissionError}
        ppgHeartRate={ppg.state.lastResult?.heartRate || ppg.state.liveHeartRate}
        ppgHrv={ppg.state.lastResult?.hrv || 0}
        ppgAmplitude={ppg.state.liveAmplitude}
        ppgAsymmetry={vascular}
        ppgSignal={ppg.state.liveSignal}
        ppgTorch={ppg.state.torchSupported}
        ppgElapsed={ppg.state.elapsedSec}
        startPpg={ppg.start}
        stopPpg={ppg.stop}
        micActive={mic.state.active}
        micError={mic.state.permissionError}
        micAcousticState={mic.state.acoustic?.state || "idle"}
        micAcousticBpm={mic.state.acoustic?.bpm || 0}
        micSubSonic={mic.state.subSonicRatio}
        micLectinSignature={mic.state.lectinSignature}
        startMic={mic.start}
        stopMic={mic.stop}
        magAvailable={mag.state.available}
        magActive={mag.state.active}
        magError={mag.state.permissionError}
        magMicrotesla={mag.state.microtesla}
        magBaseline={mag.state.baseline}
        magSynthetic={mag.state.syntheticInterference}
        magSpikes={mag.state.spikes}
        magEmfIndex={mag.state.emfIndex}
        startMag={mag.start}
        stopMag={mag.stop}
        verdict={verdict}
      />

      <footer className="bo-footer">
        Crack #2 wired · PPG ({TARGET_FPS}fps target) · Mic (AnalyserNode) · Magnetometer (10Hz) · Crack #3 → PDF + QR
      </footer>
    </div>
  );
}

const TARGET_FPS = 30;

export default App;
