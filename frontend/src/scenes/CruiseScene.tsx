import React, { useEffect, useRef, useState } from "react";
import { usePPGScanner } from "@/hardware/usePPGScanner";
import { evaluatePostSet, pushBaseline, pushHistory, getBaselineHrv, getBaselineRestHr, type AnabolicWindow } from "@/lib/anabolicWindow";

interface Props {
  accent: string;
  onClose: () => void;
  industrialThump?: () => void;
}

const CruiseScene: React.FC<Props> = ({ accent, onClose, industrialThump }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ppg = usePPGScanner(videoRef, industrialThump);
  const [mode, setMode] = useState<"baseline" | "postset">("postset");
  const [window, setWindow] = useState<AnabolicWindow | null>(null);
  const [baselineHrv, setBaselineHrv] = useState<number>(getBaselineHrv());
  const [baselineRestHr, setBaselineRestHr] = useState<number>(getBaselineRestHr());

  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 12 && !ppg.state.lastResult) ppg.finalize();
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  const result = ppg.state.lastResult;

  const commit = () => {
    if (!result) return;
    if (mode === "baseline") {
      const next = pushBaseline(result.hrv, result.heartRate);
      setBaselineHrv(next.hrv);
      setBaselineRestHr(next.restHr);
    } else {
      const w = evaluatePostSet(result.hrv, result.heartRate);
      setWindow(w);
      pushHistory({
        ts: new Date().toISOString(),
        hrv: result.hrv,
        hr: result.heartRate,
        recoveryPct: w.recoveryPct,
        status: w.status,
      });
    }
    ppg.stop();
  };

  const restart = () => {
    setWindow(null);
    ppg.stop();
  };

  return (
    <div className="bo-immersion" style={{ ["--accent" as any]: accent }} data-testid="cruise-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={onClose} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">CRUISE · ANABOLIC WINDOW</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card cruise">
          <h2 className="bo-step-title">{mode === "baseline" ? "Resting Baseline" : "Post-Set Recovery"}</h2>
          <p className="bo-step-instructions">
            {mode === "baseline"
              ? "Pre-training capture — calm, seated, breath through nose. Updates rolling baseline."
              : "Within 60 s of your last set. Press fingertip to rear lens. Industrial thump every beat."}
          </p>

          <div className="bo-mode-switch" data-testid="cruise-mode-switch">
            <button className={mode === "postset" ? "on" : ""} onClick={() => setMode("postset")} data-testid="btn-cruise-postset">POST-SET</button>
            <button className={mode === "baseline" ? "on" : ""} onClick={() => setMode("baseline")} data-testid="btn-cruise-baseline">BASELINE</button>
          </div>

          <video ref={videoRef} playsInline muted autoPlay style={{ width: 1, height: 1, opacity: 0, position: "absolute" }} data-testid="cruise-video" />

          <div className="bo-blood-stats">
            <div><span>HR</span><b>{result?.heartRate || ppg.state.liveHeartRate || 0}</b><em>bpm</em></div>
            <div><span>HRV</span><b>{result?.hrv || 0}</b><em>ms</em></div>
            <div><span>Base HRV</span><b>{baselineHrv ? baselineHrv.toFixed(0) : "—"}</b><em>ms</em></div>
            <div><span>Rest HR</span><b>{baselineRestHr ? baselineRestHr.toFixed(0) : "—"}</b><em>bpm</em></div>
          </div>

          <div className="bo-step-progress">
            <span style={{ width: `${Math.min(100, (ppg.state.elapsedSec / 12) * 100)}%` }} />
          </div>

          {ppg.state.permissionError && <p className="bo-error">⚠︎ {ppg.state.permissionError}</p>}

          {window && (
            <div className={`bo-anabolic status-${window.status}`} data-testid="anabolic-result">
              <span className="ribbon">ANABOLIC · {window.status.toUpperCase()}</span>
              <div className="bigbar">
                <span className="fill" style={{ width: `${Math.round(window.recoveryPct * 100)}%` }} />
                <span className="pct">{Math.round(window.recoveryPct * 100)}% recovery</span>
              </div>
              <p className="directive">{window.directive}</p>
              <div className="meta">
                <span>ΔHR <b>{window.hrDelta > 0 ? "+" : ""}{window.hrDelta} bpm</b></span>
                <span>baseline HRV <b>{window.baselineHrv} ms</b></span>
              </div>
            </div>
          )}

          <div className="bo-step-controls">
            {!ppg.state.active && !result ? (
              <button className="bo-glass-btn primary" onClick={ppg.start} data-testid="btn-cruise-start">
                {mode === "baseline" ? "Capture Baseline" : "Begin Post-Set Scan"}
              </button>
            ) : ppg.state.active && !result ? (
              <button className="bo-glass-btn" disabled>Scanning {ppg.state.elapsedSec.toFixed(1)}s</button>
            ) : (
              <>
                <button className="bo-glass-btn primary" onClick={commit} data-testid="btn-cruise-commit">
                  {mode === "baseline" ? "Save Baseline" : "Compute Window"}
                </button>
                <button className="bo-glass-btn" onClick={restart} data-testid="btn-cruise-restart">Re-scan</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CruiseScene;
