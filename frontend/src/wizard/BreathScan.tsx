import React, { useEffect } from "react";
import { useBreathAnalyzer } from "@/hardware/useBreathAnalyzer";

interface Props {
  onComplete: (payload: { duration: number; intensity: number; evenness: number; frames: number }) => void;
  onSkip: () => void;
  accent: string;
}

/**
 * Breath Analysis dial — sensor-only step.
 *  Pre-roll 2 s for baseline, then captures the next exhale onset → offset.
 */
const BreathScan: React.FC<Props> = ({ onComplete, onSkip, accent }) => {
  const breath = useBreathAnalyzer();

  // Auto-start when the step mounts
  useEffect(() => {
    breath.start();
    return () => breath.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proceed = () => {
    if (!breath.state.exhale) return;
    onComplete(breath.state.exhale);
  };

  return (
    <div className="bo-step" style={{ ["--accent" as any]: accent }} data-testid="step-breath">
      <h2 className="bo-step-title">Breath · Analysis</h2>
      <p className="bo-step-instructions">
        Calibrating ambient noise for 2 s. Then exhale once, long and steady, toward the bottom of the phone.
      </p>

      <div className="bo-breath-readout" data-testid="breath-readout">
        <div className="row"><span>Phase</span><b data-testid="breath-phase">{breath.state.phase.toUpperCase()}</b></div>
        <div className="row"><span>Sample rate</span><b>{breath.state.sampleRate} Hz · fft {breath.state.fftSize}</b></div>
        <div className="row"><span>Band</span><b>{breath.state.midBandHz[0]}–{breath.state.midBandHz[1]} Hz</b></div>
        <div className="row"><span>Baseline RMS</span><b data-testid="breath-baseline">{breath.state.baselineRms.toFixed(4)}</b></div>
        <div className="row"><span>Live RMS</span><b data-testid="breath-live">{breath.state.liveRms.toFixed(4)}</b></div>
        <div className="row"><span>Peak RMS</span><b data-testid="breath-peak">{breath.state.peakRms.toFixed(4)}</b></div>
      </div>

      {breath.state.exhale && (
        <div className="bo-breath-result" data-testid="breath-result">
          <div className="row"><span>Duration</span><b data-testid="breath-duration">{breath.state.exhale.duration.toFixed(2)} s</b></div>
          <div className="row"><span>Intensity</span><b data-testid="breath-intensity">{breath.state.exhale.intensity.toFixed(3)}</b></div>
          <div className="row"><span>Evenness</span><b data-testid="breath-evenness">{(breath.state.exhale.evenness * 100).toFixed(0)}%</b></div>
          <div className="row"><span>Frames</span><b>{breath.state.exhale.frames}</b></div>
        </div>
      )}

      {breath.state.permissionError && (
        <p className="bo-error" data-testid="breath-error">⚠︎ {breath.state.permissionError}</p>
      )}

      <div className="bo-step-controls">
        {breath.state.phase === "done" && breath.state.exhale ? (
          <>
            <button className="bo-glass-btn primary" onClick={proceed} data-testid="btn-breath-next">Use Reading →</button>
            <button className="bo-glass-btn" onClick={breath.reset} data-testid="btn-breath-retry">Re-exhale</button>
          </>
        ) : (
          <button className="bo-glass-btn" disabled data-testid="btn-breath-waiting">
            {breath.state.phase === "calibrating" ? "Calibrating ambient…" :
             breath.state.phase === "ready" ? "Exhale now…" :
             breath.state.phase === "exhaling" ? "Capturing exhale…" : "Stand by…"}
          </button>
        )}
        <button className="bo-glass-btn" onClick={() => { breath.stop(); onSkip(); }} data-testid="btn-breath-skip">Skip</button>
      </div>
    </div>
  );
};

export default BreathScan;
