import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "@/styles/bioracle.css";
import HealthBattery from "@/components/HealthBattery";
import TriageDashboard from "@/components/TriageDashboard";
import {
  emergencyTriage,
  fingerprintToABO,
  stomachAcousticAnalysis,
  type ABOEstimate,
  type StomachAcousticSignal,
  type TriageVerdict,
} from "@/SovereignLogic";

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
  const [lectin, setLectin] = useState(0.18);
  const [vascular, setVascular] = useState(0.22);
  const [emf, setEmf] = useState(0.12);
  const [acousticBpm, setAcousticBpm] = useState(8);
  const [heartRate, setHeartRate] = useState(0); // Crack #2 will populate from PPG
  const [scanIntensity, setScanIntensity] = useState(0);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [lastLedgerId, setLastLedgerId] = useState<string | null>(null);

  // Acoustic mock: synthesise a sample whose event-rate matches the slider so the
  // SovereignLogic.stomachAcousticAnalysis pipeline is genuinely exercised.
  const acoustic: StomachAcousticSignal = useMemo(() => {
    const sr = 4000;
    const dur = 2;
    const n = sr * dur;
    const samples = new Float32Array(n);
    const targetEvents = Math.max(0, acousticBpm) * (dur / 60); // events in window
    const spacing = targetEvents > 0 ? n / targetEvents : n;
    for (let i = 0; i < n; i++) {
      const phase = (i % spacing) / spacing;
      // Brief click + low rumble
      const click = phase < 0.04 ? (Math.random() - 0.5) * 0.9 : 0;
      const rumble = Math.sin((2 * Math.PI * 80 * i) / sr) * 0.012;
      samples[i] = click + rumble;
    }
    return stomachAcousticAnalysis({ sampleRate: sr, samples, durationSec: dur });
  }, [acousticBpm]);

  const verdict: TriageVerdict = useMemo(
    () =>
      emergencyTriage({
        lectin,
        vascularAsymmetry: vascular,
        emf,
        acoustic,
        heartRate: heartRate || undefined,
        blood: DEFAULT_BLOOD,
      }),
    [lectin, vascular, emf, acoustic, heartRate],
  );

  // Sovereign health charge: inverse of triage score, lightly weighted by signals.
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

  // Synthetic scan: ramps scanIntensity and a faux HR so the gold-glow pulse
  // demonstrates frequency-locking ahead of Crack #2 camera wiring.
  const runScan = async () => {
    setScanIntensity(0);
    const start = Date.now();
    const duration = 6000;
    const targetHr = 64 + Math.random() * 24; // 64..88 mock
    return new Promise<void>((resolve) => {
      const tick = () => {
        const t = (Date.now() - start) / duration;
        if (t >= 1) {
          setScanIntensity(1);
          setHeartRate(targetHr);
          resolve();
          return;
        }
        setScanIntensity(t);
        // ease HR up to target so the pulse animation re-tunes live
        setHeartRate(targetHr * Math.min(1, t * 1.2));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  const commitToLedger = async () => {
    try {
      const payload = {
        lectin,
        vascular_asymmetry: vascular,
        emf,
        acoustic: {
          state: acoustic.state,
          bpm: acoustic.bpm,
          spectral_centroid: acoustic.spectralCentroid,
          irritation_index: acoustic.irritationIndex,
        },
        heart_rate: heartRate,
        blood: DEFAULT_BLOOD,
        verdict,
      };
      const res = await axios.post(`${API}/triage/scan`, payload);
      setLastLedgerId(res.data?.id ?? null);
    } catch (e) {
      console.error("Ledger write failed", e);
    }
  };

  return (
    <div className="bo-app" data-testid="bioracle-root">
      <header className="bo-header">
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">Sovereign Triage</h1>
        <span className="tagline">
          Crack #1 · Shell · Obsidian &amp; Gold · {backendOk === null ? "linking ledger…" : backendOk ? "ledger online" : "ledger offline"}
        </span>
      </header>

      <HealthBattery
        charge={charge}
        heartRate={heartRate}
        severity={severity}
        scanIntensity={scanIntensity}
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

      <div className="bo-controls">
        <button
          className="bo-btn"
          onClick={runScan}
          data-testid="btn-run-scan"
          disabled={scanIntensity > 0 && scanIntensity < 1}
        >
          Run Mock Scan
        </button>
        <button
          className="bo-btn ghost"
          onClick={commitToLedger}
          data-testid="btn-commit-ledger"
          disabled={backendOk !== true}
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
        lectin={lectin}
        vascularAsymmetry={vascular}
        emf={emf}
        acousticBpm={acousticBpm}
        acousticState={acoustic.state}
        heartRate={heartRate}
        bloodGroup={`${DEFAULT_BLOOD.group}${DEFAULT_BLOOD.rh}`}
        verdict={verdict}
        onChangeLectin={setLectin}
        onChangeVascular={setVascular}
        onChangeEmf={setEmf}
        onChangeAcoustic={setAcousticBpm}
      />

      <footer className="bo-footer">
        Crack #2 · PPG (rear-cam + flash) · Stomach mic · Magnetometer · Gold-on-Obsidian PDF
      </footer>
    </div>
  );
}

export default App;
