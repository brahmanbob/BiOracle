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
}

type Step = "retinol" | "tongue" | "blood" | "banter";

interface BloodPayload {
  heartRate: number; hrv: number; asymmetry: number; amplitude: number;
  vascularAge: number; agingIndex: number;
}

const MedicalRitual: React.FC<Props> = ({ accent, onClose, lectinSignature, emfMicrotesla, syntheticInterference, haptic, pdfPrint }) => {
  const [step, setStep] = useState<Step>("retinol");
  const [sclera, setSclera] = useState<ScleraReading | null>(null);
  const [tongue, setTongue] = useState<TongueReading | null>(null);
  const [blood, setBlood] = useState<BloodPayload | undefined>(undefined);

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

      <div className="bo-imm-body">
        {step === "retinol" && (
          <RetinolScan
            accent={accent}
            onComplete={(r) => { setSclera(r); setStep("tongue"); }}
            onSkip={() => setStep("tongue")}
          />
        )}
        {step === "tongue" && (
          <TongueScan
            accent={accent}
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
