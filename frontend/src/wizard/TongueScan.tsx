import React, { useRef, useState } from "react";
import { useFrontCamera } from "@/hardware/useFrontCamera";
import { analyseTongue, type TongueReading, type ScanLighting } from "@/lib/imageAnalysis";

interface Props {
  onComplete: (reading: TongueReading) => void;
  onSkip: () => void;
  accent: string;
  lighting?: ScanLighting;
}

const TongueScan: React.FC<Props> = ({ onComplete, onSkip, accent, lighting = "indoor" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cam = useFrontCamera(videoRef);
  const [reading, setReading] = useState<TongueReading | null>(null);

  const handleCapture = () => {
    const img = cam.capture();
    if (img) setReading(analyseTongue(img, lighting));
  };

  return (
    <div className="bo-step" style={{ ["--accent" as any]: accent }} data-testid="step-tongue">
      <h2 className="bo-step-title">Tongue · Body</h2>
      <p className="bo-step-instructions">
        Stick the tongue straight out and fill the frame. Natural light if possible.
      </p>

      <div className="bo-cam-stage" data-testid="tongue-stage">
        <video ref={videoRef} playsInline muted autoPlay className={cam.state.active ? "" : "hidden"} />
        {!cam.state.active && (
          <div className="bo-cam-placeholder">
            <span>{cam.state.permissionError ? "⚠︎ " + cam.state.permissionError : "Camera offline"}</span>
          </div>
        )}
        {cam.state.lastCaptureUrl && (
          <img src={cam.state.lastCaptureUrl} alt="tongue" className="bo-cam-thumb" data-testid="tongue-thumb" />
        )}
      </div>

      {reading && (
        <div className="bo-reading-block" data-testid="tongue-reading">
          <div className="row"><span>State</span><b className={`ind-${reading.state}`}>{reading.state}</b></div>
          <div className="row"><span>Hue</span><b>{reading.hue}</b></div>
          <div className="row"><span>Coating</span><b>{(reading.coating * 100).toFixed(0)}%</b></div>
          <div className="row"><span>Redness</span><b>{(reading.redness * 100).toFixed(0)}%</b></div>
          <p className="rationale">{reading.rationale}</p>
        </div>
      )}

      <div className="bo-step-controls">
        {!cam.state.active ? (
          <button className="bo-glass-btn primary" onClick={cam.start} data-testid="btn-tongue-start">Open Camera</button>
        ) : !reading ? (
          <button className="bo-glass-btn primary" onClick={handleCapture} data-testid="btn-tongue-capture">Capture</button>
        ) : (
          <button className="bo-glass-btn primary" onClick={() => { cam.stop(); onComplete(reading); }} data-testid="btn-tongue-next">Next →</button>
        )}
        <button className="bo-glass-btn" onClick={() => { cam.stop(); onSkip(); }} data-testid="btn-tongue-skip">Skip</button>
      </div>
    </div>
  );
};

export default TongueScan;
