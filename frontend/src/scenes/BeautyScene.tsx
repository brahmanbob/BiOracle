import React, { useEffect, useRef, useState } from "react";
import { analyseSkin, type SkinReading } from "@/lib/skinAnalysis";

interface Props {
  accent: string;
  onClose: () => void;
}

const BeautyScene: React.FC<Props> = ({ accent, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [reading, setReading] = useState<SkinReading | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    setPermError(null);
    setReading(null);
    setThumbUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      try {
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        if (caps?.torch) {
          // @ts-ignore
          await track.applyConstraints({ advanced: [{ torch: true }] });
          setTorch(true);
        }
      } catch { /* ok */ }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e: any) {
      setPermError(e?.message || "Camera permission denied");
    }
  };

  const stop = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
    setTorch(false);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const w = Math.min(640, v.videoWidth);
    const h = Math.min(480, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    setThumbUrl(canvas.toDataURL("image/jpeg", 0.65));
    const img = ctx.getImageData(0, 0, w, h);
    const r = analyseSkin(img);
    setReading(r);
  };

  return (
    <div className="bo-immersion" style={{ ["--accent" as any]: accent }} data-testid="beauty-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">BEAUTY · GLOW INDEX</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card beauty">
          <h2 className="bo-step-title">Sub-Dermal Glow</h2>
          <p className="bo-step-instructions">
            Rear lens + flash on the cheek — hold 3 cm away, even contact. Capture when frame is still.
          </p>

          <div className="bo-cam-stage" data-testid="beauty-stage">
            <video ref={videoRef} playsInline muted autoPlay className={active ? "" : "hidden"} />
            {!active && (
              <div className="bo-cam-placeholder">
                <span>{permError ? "⚠︎ " + permError : "Camera offline"}</span>
              </div>
            )}
            {thumbUrl && <img src={thumbUrl} alt="skin" className="bo-cam-thumb" data-testid="beauty-thumb" />}
            {torch && <span className="bo-torch-pill">torch on</span>}
          </div>

          {reading && (
            <div className={`bo-glow tier-${reading.tier}`} data-testid="glow-result">
              <div className="dial">
                <span className="num">{reading.glowIndex}</span>
                <span className="lbl">GLOW INDEX</span>
                <span className="tier">{reading.tier.toUpperCase()}</span>
              </div>
              <div className="rows">
                <div className="row"><span>Oxygenation</span><b>{(reading.oxygenation * 100).toFixed(0)}%</b></div>
                <div className="row"><span>Uniformity</span><b>{(reading.uniformity * 100).toFixed(0)}%</b></div>
                <div className="row"><span>Hydration</span><b>{(reading.hydration * 100).toFixed(0)}%</b></div>
                <div className="row"><span>Erythema</span><b>{(reading.erythema * 100).toFixed(0)}%</b></div>
                <div className="row"><span>Yellow shift</span><b>{(reading.yellowShift * 100).toFixed(0)}%</b></div>
              </div>
              <p className="rationale">{reading.rationale}</p>
            </div>
          )}

          <div className="bo-step-controls">
            {!active ? (
              <button className="bo-glass-btn primary" onClick={start} data-testid="btn-beauty-start">Open Lens + Flash</button>
            ) : !reading ? (
              <button className="bo-glass-btn primary" onClick={capture} data-testid="btn-beauty-capture">Capture</button>
            ) : (
              <>
                <button className="bo-glass-btn" onClick={() => { setReading(null); setThumbUrl(null); }} data-testid="btn-beauty-retake">Re-capture</button>
                <button className="bo-glass-btn primary" onClick={() => { stop(); onClose(); }} data-testid="btn-beauty-done">Done</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeautyScene;
