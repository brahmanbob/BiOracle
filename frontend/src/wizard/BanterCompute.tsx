import React, { useState } from "react";
import { generateRemedy, type RemedyCard, type RitualScans } from "@/lib/remedyEngine";
import { emergencyTriage, fingerprintToABO } from "@/SovereignLogic";

interface Props {
  sclera: RitualScans["sclera"];
  tongue: RitualScans["tongue"];
  bloodPayload?: {
    heartRate: number; hrv: number; asymmetry: number; amplitude: number;
    vascularAge: number; agingIndex: number;
  };
  lectinSignature: number;
  emfMicrotesla: number;
  syntheticInterference: boolean;
  onPdf?: (remedy: RemedyCard) => Promise<void> | void;
  onClose: () => void;
  accent: string;
}

const DEFAULT_BLOOD = fingerprintToABO({
  ridgeDensity: 12.5, whorlRatio: 0.4, loopRatio: 0.4, archRatio: 0.2, minutiaeIndex: 0.55,
});

const BanterCompute: React.FC<Props> = ({
  sclera, tongue, bloodPayload, lectinSignature, emfMicrotesla, syntheticInterference, onPdf, onClose, accent,
}) => {
  const [banterText, setBanterText] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "oracle"; text: string }>>([
    { role: "oracle", text: "I have your scans. Speak — what does the body know that the sensors did not?" },
  ]);
  const [remedy, setRemedy] = useState<RemedyCard | null>(null);

  // Build a verdict from the available signals
  const verdict = emergencyTriage({
    lectin: lectinSignature,
    vascularAsymmetry: bloodPayload?.asymmetry ?? 0,
    emf: emfMicrotesla > 0 ? Math.max(0, Math.min(1, (emfMicrotesla - 30) / 120)) : 0,
    heartRate: bloodPayload?.heartRate,
    blood: DEFAULT_BLOOD,
  });

  const compute = () => {
    const scans: RitualScans = {
      sclera, tongue, verdict,
      heartRate: bloodPayload?.heartRate ?? 0,
      hrv: bloodPayload?.hrv ?? 0,
      vascularAge: bloodPayload?.vascularAge ?? 0,
      vascularAsymmetry: bloodPayload?.asymmetry ?? 0,
      lectinSignature,
      syntheticInterference,
    };
    const r = generateRemedy(scans, banterText);
    setRemedy(r);
    setHistory((h) => [
      ...h,
      ...(banterText ? [{ role: "user" as const, text: banterText }] : []),
      { role: "oracle", text: r.banter },
    ]);
    setBanterText("");
  };

  const reset = () => { setRemedy(null); };

  return (
    <div className="bo-banter" style={{ ["--accent" as any]: accent }} data-testid="step-banter">
      <h2 className="bo-step-title">Banter · Compute</h2>

      <div className="bo-banter-thread" data-testid="banter-thread">
        {history.map((m, i) => (
          <div key={i} className={`bo-msg ${m.role}`}>
            <span className="who">{m.role === "user" ? "You" : "Oracle"}</span>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      {!remedy ? (
        <>
          <textarea
            className="bo-banter-input"
            placeholder="Pain? Sleep? Mood? Anything the body whispered today…"
            value={banterText}
            onChange={(e) => setBanterText(e.target.value)}
            rows={3}
            data-testid="banter-input"
          />
          <div className="bo-step-controls">
            <button className="bo-glass-btn primary" onClick={compute} data-testid="btn-banter-compute">Compute Remedy</button>
            <button className="bo-glass-btn" onClick={onClose} data-testid="btn-banter-close">Close</button>
          </div>
        </>
      ) : (
        <div className={`bo-remedy band-${remedy.band}`} data-testid="remedy-card">
          <div className="head">
            <span className="ribbon">REMEDY · {remedy.band.toUpperCase()}</span>
            <h3>{remedy.topConcern}</h3>
          </div>
          <ol className="actions">
            {remedy.actions.map((a, i) => (
              <li key={i} className={`action k-${a.kind}`}>
                <span className="kind">{a.kind}</span>
                <span className="text">{a.text}</span>
              </li>
            ))}
          </ol>
          <div className="ritual">
            <span className="lbl">Today's Ritual</span>
            <p>{remedy.ritual}</p>
          </div>
          {remedy.echoedSymptoms.length > 0 && (
            <div className="echoed">Echoed: {remedy.echoedSymptoms.join(" · ")}</div>
          )}
          {remedy.flags.length > 0 && (
            <div className="bo-flags">
              {remedy.flags.map((f) => (
                <span key={f} className={`bo-flag ${f.includes("critical") || f.includes("bleeding") ? "danger" : ""}`}>{f}</span>
              ))}
            </div>
          )}
          <div className="bo-step-controls">
            {onPdf && remedy.band !== "stable" && (
              <button className="bo-glass-btn primary" onClick={() => onPdf(remedy)} data-testid="btn-remedy-pdf">Print PDF for Medic</button>
            )}
            <button className="bo-glass-btn" onClick={reset} data-testid="btn-remedy-restart">Re-ask</button>
            <button className="bo-glass-btn" onClick={onClose} data-testid="btn-remedy-close">Close Ritual</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BanterCompute;
