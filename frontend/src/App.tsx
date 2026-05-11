import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "@/styles/bioracle.css";
import LiquidVialBattery from "@/components/LiquidVialBattery";
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
import { useHaptics } from "@/hardware/useHaptics";
import { computeVascularAge, type APGResult } from "@/lib/vascularAge";
import { downloadBioracleReport } from "@/lib/pdfReport";

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
  const haptics = useHaptics(true);

  // PPG: per-beat haptic thump
  const ppg = usePPGScanner(videoRef, () => haptics.thump());
  const mic = useStomachMic();
  const mag = useMagnetometer();

  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [lastLedgerId, setLastLedgerId] = useState<string | null>(null);
  const [stealth, setStealth] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [vascularAge, setVascularAge] = useState<APGResult | null>(null);
  const lastCriticalRef = useRef(false);

  // Derived sensor inputs
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

  // Critical-state haptic alarm (one-shot per transition)
  useEffect(() => {
    if (verdict.critical && !lastCriticalRef.current) {
      if (verdict.level === "sovereign-override") haptics.sovereignChime();
      else haptics.criticalBuzz();
    }
    lastCriticalRef.current = verdict.critical;
  }, [verdict.critical, verdict.level, haptics]);

  // Auto-finalize PPG result + compute vascular age after 12s
  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 12 && !ppg.state.lastResult) {
      ppg.finalize();
    }
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  // Recompute vascular age (APG) once we have a finalized PPG or enough raw samples
  useEffect(() => {
    const samples = ppg.state.rawSamples;
    if (samples.length < 90) return;
    const fs = ppg.state.sampleRate || 30;
    const apg = computeVascularAge({ samples, fs });
    if (apg.vascularAge > 0) setVascularAge(apg);
  }, [ppg.state.rawSamples, ppg.state.sampleRate]);

  const commitToLedger = async () => {
    haptics.softTap();
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
          apg: vascularAge,
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

  const printPdfForMedic = async () => {
    haptics.heavyClick();
    setGeneratingPdf(true);
    try {
      // Make sure we have a scan id — commit first if not
      let scanId = lastLedgerId;
      if (!scanId) {
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
            apg: vascularAge,
            mag: {
              microtesla: mag.state.microtesla,
              baseline: mag.state.baseline,
              spikes: mag.state.spikes,
              synthetic: mag.state.syntheticInterference,
            },
          },
        };
        const res = await axios.post(`${API}/triage/scan`, payload);
        scanId = res.data.id;
        setLastLedgerId(scanId);
      }
      await downloadBioracleReport({
        scanId: scanId!,
        backendUrl: BACKEND_URL,
        verdict,
        heartRate: heartRate || 0,
        hrv: ppg.state.lastResult?.hrv ?? 0,
        ppgAmplitude: ppg.state.liveAmplitude,
        vascularAge: vascularAge?.vascularAge ?? 0,
        agingIndex: vascularAge?.agingIndex ?? 0,
        vascularAsymmetry: vascular,
        lectinSignature: lectin,
        subSonicRatio: mic.state.subSonicRatio,
        acousticState: mic.state.acoustic?.state ?? "idle",
        acousticBpm: mic.state.acoustic?.bpm ?? 0,
        emfMicrotesla: mag.state.microtesla,
        emfSpikes: mag.state.spikes,
        bloodGroup: `${DEFAULT_BLOOD.group}${DEFAULT_BLOOD.rh}`,
      });
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const startAll = async () => {
    haptics.softTap();
    await ppg.start();
    await mic.start();
    if (mag.state.available) await mag.start();
  };

  const stopAll = () => {
    haptics.softTap();
    ppg.stop();
    mic.stop();
    mag.stop();
  };

  const toggleStealth = () => {
    haptics.heavyClick();
    setStealth((s) => !s);
  };

  return (
    <div className={`bo-app ${stealth ? "stealth" : ""}`} data-testid="bioracle-root">
      <header className="bo-header">
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">Sovereign Triage</h1>
        <span className="tagline">
          Crack #3 · Golden Relic · {backendOk === null ? "linking ledger…" : backendOk ? "ledger online" : "ledger offline"}
          {ppg.state.active && " · PPG live"}
          {mic.state.active && " · mic live"}
          {mag.state.active && ` · mag ${mag.state.microtesla.toFixed(1)}µT`}
          {haptics.supported ? " · haptics on" : " · no haptics"}
        </span>
        <button
          className={`bo-stealth-toggle ${stealth ? "on" : ""}`}
          onClick={toggleStealth}
          data-testid="btn-stealth"
          aria-pressed={stealth}
        >
          {stealth ? "◉ STEALTH" : "○ STEALTH"}
        </button>
      </header>

      <LiquidVialBattery
        charge={charge}
        heartRate={heartRate}
        severity={severity}
        ppgAmplitude={ppg.state.liveAmplitude}
        syntheticInterference={mag.state.syntheticInterference}
        emfMicrotesla={mag.state.microtesla}
        lastBeatTs={ppg.state.lastBeatTs}
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

      {/* Hidden video for PPG canvas pipeline */}
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
          className="bo-glass-btn primary"
          onClick={startAll}
          disabled={ppg.state.active || mic.state.active}
          data-testid="btn-start-all"
        >
          Run Full Scan
        </button>
        <button
          className="bo-glass-btn"
          onClick={stopAll}
          disabled={!ppg.state.active && !mic.state.active && !mag.state.active}
          data-testid="btn-stop-all"
        >
          Stop All
        </button>
        <button
          className="bo-glass-btn"
          onClick={commitToLedger}
          disabled={backendOk !== true}
          data-testid="btn-commit-ledger"
        >
          Commit Ledger
        </button>
        <button
          className={`bo-glass-btn ${verdict.critical ? "critical-pulse" : ""}`}
          onClick={printPdfForMedic}
          disabled={backendOk !== true || generatingPdf}
          data-testid="btn-print-pdf"
        >
          {generatingPdf ? "Casting…" : verdict.critical ? "Print PDF for Medic" : "Print PDF"}
        </button>
        {lastLedgerId && (
          <span
            className="bo-mono bo-gold ledger-pill"
            data-testid="ledger-id"
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
        vascularAge={vascularAge?.vascularAge ?? 0}
        agingIndex={vascularAge?.agingIndex ?? 0}
        stiffnessIndex={vascularAge?.stiffnessIndex ?? 0}
        startPpg={() => { haptics.softTap(); ppg.start(); }}
        stopPpg={() => { haptics.softTap(); ppg.stop(); }}
        micActive={mic.state.active}
        micError={mic.state.permissionError}
        micAnalyser={mic.state.analyser}
        micAcousticState={mic.state.acoustic?.state || "idle"}
        micAcousticBpm={mic.state.acoustic?.bpm || 0}
        micSubSonic={mic.state.subSonicRatio}
        micLectinSignature={mic.state.lectinSignature}
        startMic={() => { haptics.softTap(); mic.start(); }}
        stopMic={() => { haptics.softTap(); mic.stop(); }}
        magAvailable={mag.state.available}
        magActive={mag.state.active}
        magError={mag.state.permissionError}
        magMicrotesla={mag.state.microtesla}
        magBaseline={mag.state.baseline}
        magSynthetic={mag.state.syntheticInterference}
        magSpikes={mag.state.spikes}
        magEmfIndex={mag.state.emfIndex}
        startMag={() => { haptics.softTap(); mag.start(); }}
        stopMag={() => { haptics.softTap(); mag.stop(); }}
        verdict={verdict}
      />

      <footer className="bo-footer">
        Crack #3 · Golden Relic · Liquid Vial · APG Vascular Age · Spectrogram · Haptic Engine · Shareable PDF
      </footer>
    </div>
  );
}

export default App;
