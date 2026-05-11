import React from "react";
import SignalCard from "@/components/SignalCard";
import Spectrogram from "@/components/Spectrogram";
import type { TriageVerdict } from "@/SovereignLogic";

interface SensorPanelProps {
  // PPG
  ppgActive: boolean;
  ppgError: string | null;
  ppgHeartRate: number;
  ppgHrv: number;
  ppgAmplitude: number;
  ppgAsymmetry: number;
  ppgSignal: number[];
  ppgTorch: boolean;
  ppgElapsed: number;
  vascularAge: number;
  agingIndex: number;
  stiffnessIndex: number;
  startPpg: () => void;
  stopPpg: () => void;
  // Mic
  micActive: boolean;
  micError: string | null;
  micAnalyser: AnalyserNode | null;
  micAcousticState: string;
  micAcousticBpm: number;
  micSubSonic: number;
  micLectinSignature: number;
  startMic: () => void;
  stopMic: () => void;
  // Magnetometer
  magAvailable: boolean;
  magActive: boolean;
  magError: string | null;
  magMicrotesla: number;
  magBaseline: number;
  magSynthetic: boolean;
  magSpikes: number;
  magEmfIndex: number;
  startMag: () => void;
  stopMag: () => void;
  verdict: TriageVerdict;
}

const sev = (x: number): "stable" | "elevated" | "critical" => {
  if (x >= 0.7) return "critical";
  if (x >= 0.4) return "elevated";
  return "stable";
};

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (!data || data.length < 2) return null;
  const w = 240, h = 44;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="bo-spark" data-testid="ppg-sparkline">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd966" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffd966" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#spark-fill)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#ffd966" strokeWidth="1.5" />
    </svg>
  );
};

const TriageDashboard: React.FC<SensorPanelProps> = ({
  ppgActive, ppgError, ppgHeartRate, ppgHrv, ppgAmplitude, ppgAsymmetry, ppgSignal, ppgTorch, ppgElapsed,
  vascularAge, agingIndex, stiffnessIndex,
  startPpg, stopPpg,
  micActive, micError, micAnalyser, micAcousticState, micAcousticBpm, micSubSonic, micLectinSignature,
  startMic, stopMic,
  magAvailable, magActive, magError, magMicrotesla, magBaseline, magSynthetic, magSpikes, magEmfIndex,
  startMag, stopMag,
  verdict,
}) => {
  return (
    <section data-testid="triage-dashboard">
      <div className="bo-dashboard">

        {/* --- Vascular / PPG + APG vascular age --- */}
        <SignalCard
          label="Vascular Triage"
          channel="CH · 02 · PPG"
          value={(ppgAsymmetry * 100).toFixed(0)}
          unit="% asym"
          intensity={ppgAsymmetry}
          severity={sev(ppgAsymmetry)}
          footnote={
            ppgError
              ? `Camera · ${ppgError}`
              : ppgActive
              ? `Live · ${ppgHeartRate || 0}bpm · HRV ${ppgHrv}ms · amp ${ppgAmplitude.toFixed(2)} · ${ppgTorch ? "torch on" : "no torch"} · ${ppgElapsed.toFixed(1)}s`
              : "Tap Scan → place fingertip over rear lens + flash for 12 s"
          }
          testId="signal-vascular"
        >
          <Sparkline data={ppgSignal} />

          {/* Vascular Age — APG second-derivative readout */}
          <div className="bo-apg-row" data-testid="apg-readout">
            <div className="bo-apg-cell">
              <span className="lbl">Vascular Age</span>
              <span className="val">{vascularAge ? `${vascularAge} y` : "—"}</span>
            </div>
            <div className="bo-apg-cell">
              <span className="lbl">AGI</span>
              <span className="val">{vascularAge ? agingIndex.toFixed(2) : "—"}</span>
            </div>
            <div className="bo-apg-cell">
              <span className="lbl">b/a</span>
              <span className="val">{vascularAge ? stiffnessIndex.toFixed(2) : "—"}</span>
            </div>
          </div>

          <div className="bo-mini-controls">
            {!ppgActive ? (
              <button className="bo-glass-mini" onClick={startPpg} data-testid="btn-start-ppg">▶ PPG Scan</button>
            ) : (
              <button className="bo-glass-mini ghost" onClick={stopPpg} data-testid="btn-stop-ppg">■ Stop</button>
            )}
          </div>
        </SignalCard>

        {/* --- Lectin / Stomach Mic + Spectrogram --- */}
        <SignalCard
          label="Lectin · Stomach"
          channel="CH · 01 · AUDIO"
          value={micLectinSignature.toFixed(2)}
          unit="lectin-sig"
          intensity={micLectinSignature}
          severity={sev(micLectinSignature)}
          footnote={
            micError
              ? `Mic · ${micError}`
              : micActive
              ? `${micAcousticState} · ${micAcousticBpm.toFixed(1)} ev/min · sub-50Hz ${(micSubSonic * 100).toFixed(0)}%`
              : "Tap Capture → hold mic against abdomen for 15 s"
          }
          testId="signal-lectin"
        >
          <Spectrogram analyser={micAnalyser} />
          <div className="bo-mini-controls">
            {!micActive ? (
              <button className="bo-glass-mini" onClick={startMic} data-testid="btn-start-mic">▶ Mic Capture</button>
            ) : (
              <button className="bo-glass-mini ghost" onClick={stopMic} data-testid="btn-stop-mic">■ Stop</button>
            )}
          </div>
        </SignalCard>

        {/* --- EMF / Magnetometer --- */}
        <SignalCard
          label="EMF Stealth"
          channel="CH · 03 · MAG"
          value={magMicrotesla.toFixed(1)}
          unit="µT"
          intensity={magEmfIndex}
          severity={magSynthetic ? "critical" : sev(magEmfIndex)}
          footnote={
            magError
              ? magError
              : magActive
              ? `Baseline ${magBaseline.toFixed(1)}µT · ${magSpikes} spikes · threshold 65µT`
              : magAvailable
              ? "Tap Scan → walk slowly past suspected EMF sources"
              : "Magnetometer unavailable in this view"
          }
          testId="signal-emf"
        >
          <div className="bo-mini-controls">
            {!magActive ? (
              <button className="bo-glass-mini" onClick={startMag} disabled={!magAvailable} data-testid="btn-start-mag">▶ EMF Scan</button>
            ) : (
              <button className="bo-glass-mini ghost" onClick={stopMag} data-testid="btn-stop-mag">■ Stop</button>
            )}
          </div>
        </SignalCard>

        {/* --- Acoustic State echo --- */}
        <SignalCard
          label="Acoustic State"
          channel="CH · 04 · MMC"
          value={micActive ? micAcousticState : "—"}
          intensity={Math.min(1, micAcousticBpm / 25)}
          severity={
            micAcousticState === "lectin-irritation" || micAcousticState === "obstruction-suspect"
              ? "critical"
              : micAcousticState === "hyperactive"
              ? "elevated"
              : "stable"
          }
          footnote={
            micActive
              ? micAcousticState === "lectin-irritation"
                ? "Low-freq rumble dominant → lectin signature peaking"
                : "MMC clicks within healthy band"
              : "Awaiting mic capture"
          }
          testId="signal-acoustic"
        />
      </div>

      <div className={`bo-verdict level-${verdict.level}`} data-testid="triage-verdict">
        <span className="score">SCORE · {verdict.score.toFixed(1)} / 100</span>
        <span className="level" data-testid="triage-verdict-level">{verdict.level.replace("-", " ")}</span>
        <div className="directive" data-testid="triage-verdict-directive">{verdict.directive}</div>
        {verdict.flags.length > 0 && (
          <div className="bo-flags" data-testid="triage-verdict-flags">
            {verdict.flags.map((f) => (
              <span
                key={f}
                className={`bo-flag ${f.includes("critical") || f.includes("bleeding") || f.includes("synthetic") ? "danger" : ""}`}
              >{f}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TriageDashboard;
