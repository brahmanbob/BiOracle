import React from "react";
import { useMagnetometer } from "@/hardware/useMagnetometer";
import { useIntent } from "@/hardware/useIntent";

interface Props {
  accent: string;
  onClose: () => void;
}

const StealthScene: React.FC<Props> = ({ accent, onClose }) => {
  const mag = useMagnetometer();
  const intent = useIntent(mag.state.active ? mag.state.microtesla : null);

  return (
    <div className={`bo-immersion ${intent.stealthEngaged ? "stealth-engaged" : ""}`} style={{ ["--accent" as any]: accent }} data-testid="stealth-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { mag.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">STEALTH · CONTEXTUAL</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card">
          <h2 className="bo-step-title">EMF × Intent</h2>
          <p className="bo-step-instructions">
            Contextual Stealth fires only when EMF spikes <em>and</em> you are focused — interference
            during ritual is the real attack vector.
          </p>

          <div className="bo-stealth-gauges" data-testid="stealth-gauges">
            <Gauge label="µT" value={mag.state.microtesla.toFixed(1)} pct={Math.min(1, mag.state.microtesla / 100)} critical={mag.state.syntheticInterference} accent={accent} />
            <Gauge label="Intent" value={intent.intent.toFixed(2)} pct={intent.intent} accent={accent} />
            <Gauge label="Dwell" value={`${intent.lastTouchSec}s`} pct={intent.dwell} accent={accent} />
            <Gauge label="Mag stability" value={intent.magStability.toFixed(2)} pct={intent.magStability} accent={accent} />
            <Gauge label="Motion stability" value={intent.motionStability.toFixed(2)} pct={intent.motionStability} accent={accent} />
            <Gauge label="Baseline µT" value={mag.state.baseline.toFixed(1)} pct={Math.min(1, mag.state.baseline / 100)} accent={accent} />
          </div>

          {intent.stealthEngaged && (
            <div className="bo-stealth-alert" data-testid="stealth-alert">
              <span className="title">⚠︎ CONTEXTUAL STEALTH ENGAGED</span>
              <p>EMF spike ({mag.state.microtesla.toFixed(1)}µT) <em>while you are focused</em> (intent {intent.intent.toFixed(2)}).
                Move 5 m from the field source and re-check.</p>
            </div>
          )}

          {!mag.state.available && (
            <p className="bo-error">⚠︎ Magnetometer unavailable in this view — open standalone in S21 Chrome.</p>
          )}
          {mag.state.permissionError && <p className="bo-error">⚠︎ {mag.state.permissionError}</p>}

          <div className="bo-step-controls">
            {!mag.state.active ? (
              <button className="bo-glass-btn primary" onClick={mag.start} disabled={!mag.state.available} data-testid="btn-stealth-start">Begin Watch</button>
            ) : (
              <button className="bo-glass-btn" onClick={mag.stop} data-testid="btn-stealth-stop">■ Stop</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface GaugeProps { label: string; value: string; pct: number; critical?: boolean; accent: string; }
const Gauge: React.FC<GaugeProps> = ({ label, value, pct, critical, accent }) => (
  <div className={`bo-gauge ${critical ? "crit" : ""}`}>
    <span className="lbl">{label}</span>
    <span className="val">{value}</span>
    <div className="bar"><span style={{ width: `${Math.round(pct * 100)}%`, background: critical ? "#ff5b50" : accent }} /></div>
  </div>
);

export default StealthScene;
