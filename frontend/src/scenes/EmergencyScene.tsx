import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { usePPGScanner } from "@/hardware/usePPGScanner";
import { computeVascularAge } from "@/lib/vascularAge";
import { emergencyTriage, fingerprintToABO } from "@/SovereignLogic";
import { downloadBioracleReport } from "@/lib/pdfReport";

interface Props {
  accent: string;
  onClose: () => void;
  haptic?: () => void;
  lectinSignature: number;
  emfMicrotesla: number;
  syntheticInterference: boolean;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
const API = `${BACKEND_URL}/api`;
const DEFAULT_BLOOD = fingerprintToABO({
  ridgeDensity: 12.5, whorlRatio: 0.4, loopRatio: 0.4, archRatio: 0.2, minutiaeIndex: 0.55,
});

const EmergencyScene: React.FC<Props> = ({ accent, onClose, haptic, lectinSignature, emfMicrotesla, syntheticInterference }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ppg = usePPGScanner(videoRef, haptic);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);

  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 12 && !ppg.state.lastResult) ppg.finalize();
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  const result = ppg.state.lastResult;
  const apg = result ? computeVascularAge({ samples: ppg.state.rawSamples, fs: ppg.state.sampleRate || 30 }) : null;
  const verdict = emergencyTriage({
    lectin: lectinSignature,
    vascularAsymmetry: result?.asymmetry ?? 0,
    emf: emfMicrotesla > 0 ? Math.max(0, Math.min(1, (emfMicrotesla - 30) / 120)) : 0,
    heartRate: result?.heartRate,
    blood: DEFAULT_BLOOD,
  });

  const printPdf = async () => {
    setBusyPdf(true);
    try {
      const payload = {
        lectin: lectinSignature,
        vascular_asymmetry: result?.asymmetry ?? 0,
        emf: emfMicrotesla > 0 ? (emfMicrotesla - 30) / 120 : 0,
        heart_rate: result?.heartRate ?? 0,
        blood: DEFAULT_BLOOD,
        verdict,
        raw: {
          ppg: result,
          apg,
          mag: { microtesla: emfMicrotesla, synthetic: syntheticInterference },
        },
      };
      const res = await axios.post(`${API}/triage/scan`, payload);
      const sid = res.data.id;
      setLedgerId(sid);
      await downloadBioracleReport({
        scanId: sid,
        backendUrl: BACKEND_URL,
        verdict,
        heartRate: result?.heartRate ?? 0,
        hrv: result?.hrv ?? 0,
        ppgAmplitude: result?.signalAmplitude ?? 0,
        vascularAge: apg?.vascularAge ?? 0,
        agingIndex: apg?.agingIndex ?? 0,
        vascularAsymmetry: result?.asymmetry ?? 0,
        lectinSignature,
        subSonicRatio: 0,
        acousticState: "n/a",
        acousticBpm: 0,
        emfMicrotesla,
        emfSpikes: 0,
        bloodGroup: `${DEFAULT_BLOOD.group}${DEFAULT_BLOOD.rh}`,
      });
    } finally {
      setBusyPdf(false);
    }
  };

  return (
    <div className="bo-immersion" style={{ ["--accent" as any]: accent }} data-testid="emergency-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { ppg.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">EMERGENCY · BLEED TRIAGE</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card">
          <h2 className="bo-step-title">Vascular PPG</h2>
          <p className="bo-step-instructions">Fingertip over rear lens + flash. 12 second window — each beat will vibrate.</p>

          <video ref={videoRef} playsInline muted autoPlay style={{ width: 1, height: 1, opacity: 0, position: "absolute" }} data-testid="emergency-video" />

          <div className="bo-blood-stats">
            <div><span>HR</span><b>{result?.heartRate || ppg.state.liveHeartRate || 0}</b><em>bpm</em></div>
            <div><span>HRV</span><b>{result?.hrv || 0}</b><em>ms</em></div>
            <div><span>Vasc Age</span><b>{apg?.vascularAge || 0}</b><em>y</em></div>
            <div><span>Asym</span><b>{((result?.asymmetry ?? 0) * 100).toFixed(0)}</b><em>%</em></div>
          </div>

          <div className="bo-step-progress">
            <span style={{ width: `${Math.min(100, (ppg.state.elapsedSec / 12) * 100)}%` }} />
          </div>

          <div className={`bo-verdict level-${verdict.level}`} data-testid="emergency-verdict">
            <span className="score">SCORE · {verdict.score.toFixed(1)} / 100</span>
            <span className="level">{verdict.level.replace("-", " ")}</span>
            <div className="directive">{verdict.directive}</div>
            {verdict.flags.length > 0 && (
              <div className="bo-flags">
                {verdict.flags.map((f) => (
                  <span key={f} className={`bo-flag ${f.includes("critical") || f.includes("bleeding") ? "danger" : ""}`}>{f}</span>
                ))}
              </div>
            )}
          </div>

          <div className="bo-step-controls">
            {!ppg.state.active ? (
              <button className="bo-glass-btn primary" onClick={ppg.start} data-testid="btn-emergency-start">Begin PPG</button>
            ) : !result ? (
              <button className="bo-glass-btn" disabled>Scanning {ppg.state.elapsedSec.toFixed(1)}s</button>
            ) : null}
            {result && (
              <button className={`bo-glass-btn primary ${verdict.critical ? "critical-pulse" : ""}`} onClick={printPdf} disabled={busyPdf} data-testid="btn-emergency-pdf">
                {busyPdf ? "Casting…" : verdict.critical ? "Print PDF for Medic" : "Print PDF"}
              </button>
            )}
            {ledgerId && <span className="bo-mono bo-gold ledger-pill">LEDGER · {ledgerId.slice(0, 8).toUpperCase()}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyScene;
