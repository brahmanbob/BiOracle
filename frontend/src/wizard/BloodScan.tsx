import React, { useEffect, useRef } from "react";
import { usePPGScanner } from "@/hardware/usePPGScanner";
import { computeVascularAge } from "@/lib/vascularAge";

interface Props {
  onComplete: (payload: {
    heartRate: number;
    hrv: number;
    asymmetry: number;
    amplitude: number;
    vascularAge: number;
    agingIndex: number;
  }) => void;
  onSkip: () => void;
  accent: string;
  haptic?: () => void;
}

const BloodScan: React.FC<Props> = ({ onComplete, onSkip, accent, haptic }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ppg = usePPGScanner(videoRef, haptic);

  // auto-finalize at 12 s
  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 12 && !ppg.state.lastResult) ppg.finalize();
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  const proceed = () => {
    const result = ppg.state.lastResult;
    if (!result) return;
    const apg = computeVascularAge({ samples: ppg.state.rawSamples, fs: ppg.state.sampleRate || 30 });
    ppg.stop();
    onComplete({
      heartRate: result.heartRate,
      hrv: result.hrv,
      asymmetry: result.asymmetry,
      amplitude: result.signalAmplitude,
      vascularAge: apg.vascularAge,
      agingIndex: apg.agingIndex,
    });
  };

  return (
    <div className="bo-step" style={{ ["--accent" as any]: accent }} data-testid="step-blood">
      <h2 className="bo-step-title">Blood · PPG</h2>
      <p className="bo-step-instructions">
        Press a fingertip over the rear lens with flash on. Hold still 12 seconds — each beat will be felt.
      </p>

      <video ref={videoRef} playsInline muted autoPlay style={{ width: 1, height: 1, opacity: 0, position: "absolute" }} data-testid="blood-video" />

      <div className="bo-blood-stats" data-testid="blood-stats">
        <div><span>HR</span><b>{ppg.state.lastResult?.heartRate || ppg.state.liveHeartRate || 0}</b><em>bpm</em></div>
        <div><span>HRV</span><b>{ppg.state.lastResult?.hrv || 0}</b><em>ms</em></div>
        <div><span>Amp</span><b>{ppg.state.liveAmplitude.toFixed(2)}</b><em></em></div>
        <div><span>Asym</span><b>{((ppg.state.lastResult?.asymmetry ?? 0) * 100).toFixed(0)}</b><em>%</em></div>
      </div>

      {ppg.state.permissionError && (
        <p className="bo-error" data-testid="blood-error">⚠︎ {ppg.state.permissionError}</p>
      )}

      <div className="bo-step-progress">
        <span style={{ width: `${Math.min(100, (ppg.state.elapsedSec / 12) * 100)}%` }} />
      </div>

      <div className="bo-step-controls">
        {!ppg.state.active ? (
          <button className="bo-glass-btn primary" onClick={ppg.start} data-testid="btn-blood-start">Begin Scan</button>
        ) : !ppg.state.lastResult ? (
          <button className="bo-glass-btn" disabled data-testid="btn-blood-scanning">Scanning {ppg.state.elapsedSec.toFixed(1)}s</button>
        ) : (
          <button className="bo-glass-btn primary" onClick={proceed} data-testid="btn-blood-next">Compute →</button>
        )}
        <button className="bo-glass-btn" onClick={() => { ppg.stop(); onSkip(); }} data-testid="btn-blood-skip">Skip</button>
      </div>
    </div>
  );
};

export default BloodScan;
