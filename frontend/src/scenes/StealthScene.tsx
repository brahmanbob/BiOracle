import React, { useEffect } from "react";
import { useMagnetometer } from "@/hardware/useMagnetometer";
import { useNativeBridge } from "@/hardware/useNativeBridge";
import type { IntentState } from "@/hardware/useIntent";
import type { AutoStealthState } from "@/hardware/useAutoStealth";

interface Props {
  accent: string;
  onClose: () => void;
  /** Pass the global intent + autoStealth from App so this view sees the live state. */
  intent: IntentState;
  autoStealth: AutoStealthState;
}

const StealthScene: React.FC<Props> = ({ accent, onClose, intent, autoStealth }) => {
  // Local magnetometer for the manual µT readout panel (in case user wants to
  // see the live trace even when ambient mag isn't auto-started)
  const mag = useMagnetometer();
  const bridge = useNativeBridge();

  const stealthFired = intent.stealthEngaged || autoStealth.active;

  // Manual override: allow user to force-engage from this scene
  const [manualResult, setManualResult] = React.useState<Awaited<ReturnType<typeof bridge.suppressRadio>> | null>(null);
  const forceEngage = async () => setManualResult(await bridge.suppressRadio());
  const release = async () => { await bridge.releaseRadio(); setManualResult(null); };

  // Stop magnetometer on unmount
  useEffect(() => () => mag.stop(), []); // eslint-disable-line

  return (
    <div className={`bo-immersion ${stealthFired ? "stealth-engaged" : ""}`} style={{ ["--accent" as any]: accent }} data-testid="stealth-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { mag.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">STEALTH · CONTEXTUAL + AUTO</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card">
          <h2 className="bo-step-title">EMF × Intent × Stillness</h2>
          <p className="bo-step-instructions">
            <em>Reactive Stealth</em> fires on µT spike while focused.&nbsp;
            <em>Auto-Stealth</em> fires <em>proactively</em> when the phone is static (mag variance &lt; 0.05µT) and screen is on — protection during reading mode.
          </p>

          <div className="bo-bridge-status" data-testid="bridge-status">
            <div className="row"><span>Runtime</span><b>{bridge.runtime}</b></div>
            <div className="row"><span>Wake Lock</span><b>{bridge.wakeLockSupported ? "ready" : "absent"}</b></div>
            <div className="row"><span>Native plugin</span><b>{bridge.hasRadioSuppressPlugin ? "ready" : bridge.hasCapacitor ? "capacitor · no plugin" : "—"}</b></div>
            <div className="row"><span>Reactive</span><b className={intent.stealthEngaged ? "on" : ""}>{intent.stealthEngaged ? "ENGAGED" : "idle"}</b></div>
            <div className="row"><span>Auto</span><b className={autoStealth.active ? "on" : ""}>{autoStealth.active ? `ENGAGED ${Math.round((Date.now() - autoStealth.engagedSince)/1000)}s` : `${autoStealth.staticTicks}/3 ticks`}</b></div>
            <div className="row"><span>Suppression</span><b className={bridge.active ? "on" : ""}>{bridge.active ? "RADIO QUIET" : "idle"}</b></div>
          </div>

          <div className="bo-stealth-gauges" data-testid="stealth-gauges">
            <Gauge label="µT" value={mag.state.microtesla.toFixed(1)} pct={Math.min(1, mag.state.microtesla / 100)} critical={mag.state.syntheticInterference} accent={accent} />
            <Gauge label="Intent" value={intent.intent.toFixed(2)} pct={intent.intent} accent={accent} />
            <Gauge label="Dwell" value={`${intent.lastTouchSec}s`} pct={intent.dwell} accent={accent} />
            <Gauge label="Mag σ" value={`${intent.magVariance.toFixed(3)}µT`} pct={Math.min(1, intent.magVariance / 1)} accent={accent} critical={intent.magVariance > 0 && intent.magVariance < 0.05} />
            <Gauge label="Motion σ" value={intent.motionVariance.toFixed(2)} pct={Math.min(1, intent.motionVariance / 2)} accent={accent} critical={intent.motionVariance < 0.25} />
            <Gauge label="Screen" value={intent.visibility ? "ON" : "OFF"} pct={intent.visibility ? 1 : 0} accent={accent} />
          </div>

          {intent.stealthEngaged && (
            <div className="bo-stealth-alert" data-testid="stealth-alert">
              <span className="title">⚠︎ REACTIVE STEALTH</span>
              <p>EMF spike ({mag.state.microtesla.toFixed(1)}µT) <em>while you are focused</em> (intent {intent.intent.toFixed(2)}).</p>
            </div>
          )}

          {autoStealth.active && (
            <div className="bo-auto-alert" data-testid="auto-alert">
              <span className="title">◉ AUTO-STEALTH ENGAGED</span>
              <p>Static phone · screen on · radio chatter being suppressed.</p>
              {autoStealth.lastResult && (
                <ul className="bridge-actions">
                  <li>Wake-lock: <b>{autoStealth.lastResult.ranWakeLock ? "held" : "n/a"}</b></li>
                  <li>Pings aborted: <b>{autoStealth.lastResult.abortedRequests}</b></li>
                  <li>Native plugin: <b>{autoStealth.lastResult.pluginInvoked ? "invoked" : "—"}</b></li>
                  {autoStealth.lastResult.airplaneModePromptShown && (
                    <li className="prompt">Flip Airplane Mode for total RF kill (OS-gated, app cannot toggle directly).</li>
                  )}
                </ul>
              )}
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
            {bridge.active ? (
              <button className="bo-glass-btn" onClick={release} data-testid="btn-stealth-release">Release Radio</button>
            ) : (
              <button className="bo-glass-btn" onClick={forceEngage} data-testid="btn-stealth-force">Force Engage</button>
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
