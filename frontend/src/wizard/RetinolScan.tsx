import React, { useRef, useState } from "react";
import { useFrontCamera } from "@/hardware/useFrontCamera";
import { analyseSclera, type ScleraReading } from "@/lib/imageAnalysis";

interface Props {
  onComplete: (reading: ScleraReading) => void;
  onSkip: () => void;
  accent: string;
}

const RetinolScan: React.FC<Props> = ({ onComplete, onSkip, accent }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cam = useFrontCamera(videoRef);
  const [reading, setReading] = useState<ScleraReading | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCapture = () => {
    setBusy(true);
    const img = cam.capture();
    if (img) {
      const r = analyseSclera(img);
      setReading(r);
    }
    setBusy(false);
  };

  return (
    <div className="bo-step" style={{ ["--accent" as any]: accent }} data-testid="step-retinol">
      <h2 className="bo-step-title">Retinol · Sclera</h2>
      <p className="bo-step-instructions">
        Front camera will open. Look straight, eyes wide, even light. Tap <em>Capture</em> when framed.
      </p>

      <div className="bo-cam-stage" data-testid="retinol-stage">
        <video ref={videoRef} playsInline muted autoPlay className={cam.state.active ? "" : "hidden"} />
        {!cam.state.active && (
          <div className="bo-cam-placeholder">
            <span>{cam.state.permissionError ? "⚠︎ " + cam.state.permissionError : "Camera offline"}</span>
          </div>
        )}
        {cam.state.lastCaptureUrl && (
          <img src={cam.state.lastCaptureUrl} alt="capture" className="bo-cam-thumb" data-testid="retinol-thumb" />
        )}
      </div>

      {reading && (
        <div className="bo-reading-block" data-testid="retinol-reading">
          <div className="row"><span>Indicator</span><b className={`ind-${reading.indicator}`}>{reading.indicator}</b></div>
          <div className="row"><span>Yellowness</span><b>{(reading.yellowness * 100).toFixed(0)}%</b></div>
          <div className="row"><span>Redness</span><b>{(reading.redness * 100).toFixed(0)}%</b></div>
          <div className="row"><span>Dryness</span><b>{(reading.dryness * 100).toFixed(0)}%</b></div>
          <p className="rationale">{reading.rationale}</p>
        </div>
      )}

      <div className="bo-step-controls">
        {!cam.state.active ? (
          <button className="bo-glass-btn primary" onClick={cam.start} data-testid="btn-retinol-start">Open Camera</button>
        ) : !reading ? (
          <button className="bo-glass-btn primary" onClick={handleCapture} disabled={busy} data-testid="btn-retinol-capture">Capture</button>
        ) : (
          <button className="bo-glass-btn primary" onClick={() => { cam.stop(); onComplete(reading); }} data-testid="btn-retinol-next">Next →</button>
        )}
        <button className="bo-glass-btn" onClick={() => { cam.stop(); onSkip(); }} data-testid="btn-retinol-skip">Skip</button>
      </div>
    </div>
  );
};

export default RetinolScan;
