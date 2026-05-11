import React from "react";
import Spectrogram from "@/components/Spectrogram";
import { useStomachMic } from "@/hardware/useStomachMic";

interface Props {
  accent: string;
  onClose: () => void;
}

const DigestionScene: React.FC<Props> = ({ accent, onClose }) => {
  const mic = useStomachMic();
  return (
    <div className="bo-immersion" style={{ ["--accent" as any]: accent }} data-testid="digestion-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { mic.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">DIGESTION · MIC</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card">
          <h2 className="bo-step-title">Stomach Acoustic</h2>
          <p className="bo-step-instructions">Hold the phone mic against your abdomen. Stay quiet.</p>

          <Spectrogram analyser={mic.state.analyser} />

          <div className="bo-blood-stats" data-testid="digestion-stats">
            <div><span>State</span><b>{mic.state.acoustic?.state || "idle"}</b><em></em></div>
            <div><span>Events</span><b>{(mic.state.acoustic?.bpm ?? 0).toFixed(1)}</b><em>/min</em></div>
            <div><span>Sub-50Hz</span><b>{(mic.state.subSonicRatio * 100).toFixed(0)}</b><em>%</em></div>
            <div><span>Lectin Sig</span><b>{(mic.state.lectinSignature * 100).toFixed(0)}</b><em>%</em></div>
          </div>

          {mic.state.permissionError && <p className="bo-error">⚠︎ {mic.state.permissionError}</p>}

          <div className="bo-step-controls">
            {!mic.state.active ? (
              <button className="bo-glass-btn primary" onClick={mic.start} data-testid="btn-digestion-start">Begin Capture</button>
            ) : (
              <button className="bo-glass-btn" onClick={mic.stop} data-testid="btn-digestion-stop">■ Stop</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigestionScene;
