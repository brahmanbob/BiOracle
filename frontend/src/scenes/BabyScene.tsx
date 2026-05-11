import React, { useEffect, useRef } from "react";
import { useRespiration } from "@/hardware/useRespiration";
import { useAmbientLight } from "@/hardware/useAmbientLight";
import { useNativeBridge } from "@/hardware/useNativeBridge";

interface Props {
  accent: string;
  onClose: () => void;
  motionVariance: number; // from global intent — used for crib stillness detection
}

const BabyScene: React.FC<Props> = ({ accent, onClose, motionVariance }) => {
  const resp = useRespiration();
  const light = useAmbientLight(true); // allow front-camera fallback when no sensor
  const bridge = useNativeBridge();
  const absoluteRef = useRef(false);

  // Crib detection = phone is still AND low light
  const stillEnough = motionVariance > 0 && motionVariance < 0.3;
  const cribMode = stillEnough && light.state.isLowLight;

  // Engage Absolute Stealth (radio quiet) when crib mode active
  useEffect(() => {
    let active = absoluteRef.current;
    if (cribMode && !active) {
      absoluteRef.current = true;
      bridge.suppressRadio().catch(() => {});
    } else if (!cribMode && active) {
      absoluteRef.current = false;
      bridge.releaseRadio().catch(() => {});
    }
  }, [cribMode, bridge]);

  // release on unmount
  useEffect(() => () => {
    if (absoluteRef.current) bridge.releaseRadio().catch(() => {});
    absoluteRef.current = false;
  }, [bridge]);

  const tier = resp.state.state;
  const tone =
    !resp.state.active ? "Mic idle. Place the phone 30–60 cm from the crib, screen facing up." :
    tier === "rhythmic" ? "Steady rhythm. Soft, even breath. You can rest." :
    tier === "watch" ? "A short quiet stretch — keep an eye, no need to startle. Pulse may just be a sigh." :
    tier === "irregular" ? "The rhythm is wandering. Stay close, check posture and warmth gently." :
    "Settling… listening for the first 8 seconds.";

  return (
    <div
      className={`bo-immersion profile-baby ${cribMode ? "absolute-stealth" : ""}`}
      style={{ ["--accent" as any]: accent }}
      data-testid="baby-immersion"
      data-absolute-stealth={cribMode ? "true" : "false"}
    >
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { resp.stop(); light.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">BIO·BABY · RHYTHMIC RESPIRATION</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card baby">
          <h2 className="bo-step-title">Crib Watch</h2>
          <p className="bo-step-instructions">
            When the phone is still and the room is dark, Absolute Stealth engages —
            zero outbound pings. The mic listens for the breath, nothing else leaves the device.
          </p>

          <div className="bo-baby-status" data-testid="baby-status">
            <div className={`pill ${cribMode ? "on" : ""}`}>
              <span className="dot" />
              CRIB MODE · {cribMode ? "ABSOLUTE STEALTH" : "stand-by"}
            </div>
            <div className="rows">
              <div className="row"><span>Ambient light</span><b>{light.state.active ? `${light.state.lux.toFixed(0)} lux` : "—"}</b></div>
              <div className="row"><span>Motion σ</span><b>{motionVariance.toFixed(2)} m/s²</b></div>
              <div className="row"><span>Light source</span><b>{light.state.source}</b></div>
            </div>
          </div>

          <div className="bo-baby-readout" data-testid="baby-readout">
            <div className={`big tier-${tier}`}>
              <span className="num">{resp.state.breathRate ? resp.state.breathRate.toFixed(0) : "—"}</span>
              <span className="lbl">breaths / min</span>
              <span className={`tier tier-${tier}`}>{tier.toUpperCase()}</span>
            </div>
            <div className="rows">
              <div className="row"><span>Rhythm</span><b>{(resp.state.rhythm * 100).toFixed(0)}%</b></div>
              <div className="row"><span>Silence since</span><b>{resp.state.silenceSec.toFixed(1)} s</b></div>
              {resp.state.apneaSuspect && <div className="row warn"><span>Apnea suspect</span><b>YES</b></div>}
            </div>
            <div className="bo-env-sparkline" aria-hidden>
              {resp.state.envelope.slice(-60).map((v, i) => (
                <span key={i} style={{ height: `${Math.min(100, v * 1200)}%` }} />
              ))}
            </div>
          </div>

          <div className="bo-baby-banter" data-testid="baby-banter">{tone}</div>

          {(resp.state.permissionError || light.state.permissionError) && (
            <p className="bo-error">⚠︎ {resp.state.permissionError || light.state.permissionError}</p>
          )}

          <div className="bo-step-controls">
            {!resp.state.active ? (
              <button className="bo-glass-btn primary" onClick={() => { resp.start(); light.start(); }} data-testid="btn-baby-start">Begin Crib Watch</button>
            ) : (
              <button className="bo-glass-btn" onClick={() => { resp.stop(); light.stop(); }} data-testid="btn-baby-stop">■ Stop</button>
            )}
            <button className="bo-glass-btn" onClick={() => { resp.stop(); light.stop(); onClose(); }} data-testid="btn-baby-done">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BabyScene;
