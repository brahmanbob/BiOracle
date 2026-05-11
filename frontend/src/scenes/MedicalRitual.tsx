import React, { useState } from "react";
import RetinolScan from "@/wizard/RetinolScan";
import TongueScan from "@/wizard/TongueScan";
import BloodScan from "@/wizard/BloodScan";
import BanterCompute from "@/wizard/BanterCompute";
import type { ScleraReading, TongueReading } from "@/lib/imageAnalysis";
import type { RemedyCard } from "@/lib/remedyEngine";

interface Props {
  accent: string;
  onClose: () => void;
  lectinSignature: number;
  emfMicrotesla: number;
  syntheticInterference: boolean;
  haptic?: () => void;
  pdfPrint?: (payload: any) => Promise<void> | void;
  profile?: "sovereign" | "cruise" | "beauty";
}

type Step = "retinol" | "tongue" | "blood" | "banter";

interface BloodPayload {
  heartRate: number; hrv: number; asymmetry: number; amplitude: number;
  vascularAge: number; agingIndex: number;
}

const MedicalRitual: React.FC<Props> = ({ accent, onClose, lectinSignature, emfMicrotesla, syntheticInterference, haptic, pdfPrint, profile }) => {
  const [step, setStep] = useState<Step>("retinol");
  const [sclera, setSclera] = useState<ScleraReading | null>(null);
  const [tongue, setTongue] = useState<TongueReading | null>(null);
  const [blood, setBlood] = useState<BloodPayload | undefined>(undefined);
  const [morning, setMorning] = useState<boolean>(() => {
    // honor ?morning=1 URL shortcut from the PWA manifest shortcut
    try { return new URLSearchParams(window.location.search).get("morning") === "1"; } catch { return false; }
  });

  const lighting = morning ? "morning" : "indoor";
  const steps: Step[] = ["retinol", "tongue", "blood", "banter"];

  return (
    <div className="bo-immersion" style={{ ["--accent" as any]: accent }} data-testid="medical-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={onClose} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">MEDICAL · RITUAL</span>
        <div className="bo-stepper" data-testid="stepper">
          {steps.map((s, i) => (
            <span key={s} className={`dot ${s === step ? "on" : steps.indexOf(step) > i ? "done" : ""}`} />
          ))}
        </div>
      </header>

      <div className="bo-morning-bar" data-testid="morning-bar">
        <label className="bo-toggle">
          <input
            type="checkbox"
            checked={morning}
            onChange={(e) => setMorning(e.target.checked)}
            data-testid="toggle-morning"
          />
          <span className="track"><span className="thumb" /></span>
          <span className="label">{morning ? "☀ Morning Calibration ON" : "⌂ Indoor Lighting"}</span>
        </label>
        <span className="hint">
          {morning
            ? "Sensitivity adjusted for indirect sunlight: higher lum floor, softer jaundice / heat thresholds."
            : "Default indoor profile — switch on for AM scans by a window."}
        </span>
      </div>

      <div className="bo-imm-body">
        {step === "retinol" && (
          <RetinolScan
            accent={accent}
            lighting={lighting}
            onComplete={(r) => { setSclera(r); setStep("tongue"); }}
            onSkip={() => setStep("tongue")}
          />
        )}
        {step === "tongue" && (
          <TongueScan
            accent={accent}
            lighting={lighting}
            onComplete={(r) => { setTongue(r); setStep("blood"); }}
            onSkip={() => setStep("blood")}
          />
        )}
        {step === "blood" && (
          <BloodScan
            accent={accent}
            haptic={haptic}
            onComplete={(p) => { setBlood(p); setStep("banter"); }}
            onSkip={() => setStep("banter")}
          />
        )}
        {step === "banter" && (
          <BanterCompute
            accent={accent}
            sclera={sclera}
            tongue={tongue}
            bloodPayload={blood}
            lectinSignature={lectinSignature}
            emfMicrotesla={emfMicrotesla}
            syntheticInterference={syntheticInterference}
            profile={profile}
            onPdf={pdfPrint ? async (remedy: RemedyCard) => {
              await pdfPrint({ sclera, tongue, blood, remedy });
            } : undefined}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default MedicalRitual;
