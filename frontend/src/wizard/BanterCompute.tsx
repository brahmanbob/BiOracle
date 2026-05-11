import React, { useState } from "react";
import { generateRemedy, type RemedyCard, type RitualScans } from "@/lib/remedyEngine";
import { emergencyTriage, fingerprintToABO } from "@/SovereignLogic";
import BanterSieve from "@/wizard/BanterSieve";
import type { SieveContext } from "@/lib/banterSieve";

interface Props {
  sclera: RitualScans["sclera"];
  tongue: RitualScans["tongue"];
  bloodPayload?: {
    heartRate: number; hrv: number; asymmetry: number; amplitude: number;
    vascularAge: number; agingIndex: number;
    bpSystolic?: number; bpDiastolic?: number; spo2?: number; signalQuality?: number;
  };
  lectinSignature: number;
  emfMicrotesla: number;
  syntheticInterference: boolean;
  onPdf?: (remedy: RemedyCard) => Promise<void> | void;
  onClose: () => void;
  accent: string;
  profile?: "sovereign" | "cruise" | "beauty" | "pet" | "baby" | "guardian";
}

const DEFAULT_BLOOD = fingerprintToABO({
  ridgeDensity: 12.5, whorlRatio: 0.4, loopRatio: 0.4, archRatio: 0.2, minutiaeIndex: 0.55,
});

const BanterCompute: React.FC<Props> = ({
  sclera, tongue, bloodPayload, lectinSignature, emfMicrotesla, syntheticInterference, onPdf, onClose, accent, profile,
}) => {
  const [banterText, setBanterText] = useState("");
  const [phase, setPhase] = useState<"sieve" | "compute">("sieve");
  const [sieve, setSieve] = useState<SieveContext | null>(null);
  const [history, setHistory] = useState<Array<{ role: "user" | "oracle"; text: string }>>([
    { role: "oracle", text: "I have your scans. Before I read them out, let me sift through context — context filters false alarms better than any algorithm." },
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
      profile,
    };
    const r = generateRemedy(scans, banterText, sieve || undefined);
    setRemedy(r);
    setHistory((h) => [
      ...h,
      ...(banterText ? [{ role: "user" as const, text: banterText }] : []),
      { role: "oracle", text: r.banter },
    ]);
    setBanterText("");
  };

  const reset = () => { setRemedy(null); };

  const onSieve = (ctx: SieveContext) => {
    setSieve(ctx);
    setPhase("compute");
    // narrate the sieve back to the user as the Guide
    const lines = ctx.explanations.length
      ? ctx.explanations
      : ["Clean context. No caffeine, sleep, stress, hydration, fasting, or medication overlay detected."];
    setHistory((h) => [
      ...h,
      { role: "user", text: "(filled the Sieve)" },
      { role: "oracle", text: "Reading the context first — " + lines.join(" ") + (ctx.demoteUrgency ? " I'll soften the alarm bell accordingly." : ctx.promoteUrgency ? " I'll widen the lens accordingly." : " I'll read the signals as they are.") },
    ]);
  };

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

      {phase === "sieve" && (
        <BanterSieve
          accent={accent}
          vitals={{
            hr: bloodPayload?.heartRate ?? 0,
            bp: bloodPayload?.bpSystolic ?? 0,
            asymmetry: bloodPayload?.asymmetry ?? 0,
          }}
          onComplete={onSieve}
          onSkip={() => setPhase("compute")}
        />
      )}

      {phase === "compute" && !remedy && (
        <>
          <textarea
            className="bo-banter-input"
            placeholder="Pain? Sleep? Mood? Anything the body whispered today…"
            value={banterText}
            onChange={(e) => setBanterText(e.target.value)}
            rows={3}
            data-testid="banter-input"
          />
          {sieve && (
            <div className="bo-sieve-summary" data-testid="sieve-summary">
              <span className="ribbon">CONTEXT SHEET</span>
              <ul>{sieve.explanations.map((e, i) => <li key={i}>{e}</li>)}</ul>
              <div className="gates">
                <span className={`gate ${sieve.doctorAdvisable ? "on" : "off"}`}>{sieve.doctorAdvisable ? "doctor: advisable" : "doctor: not flagged"}</span>
                <span className={`gate ${sieve.supplementAdvisable ? "on" : "off"}`}>{sieve.supplementAdvisable ? "supplements: ok" : "supplements: gated by meds"}</span>
              </div>
            </div>
          )}
          <div className="bo-step-controls">
            <button className="bo-glass-btn primary" onClick={compute} data-testid="btn-banter-compute">Compute Remedy</button>
            <button className="bo-glass-btn" onClick={() => setPhase("sieve")} data-testid="btn-banter-resieve">Re-Sieve</button>
            <button className="bo-glass-btn" onClick={onClose} data-testid="btn-banter-close">Close</button>
          </div>
        </>
      )}

      {phase === "compute" && remedy && (
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
