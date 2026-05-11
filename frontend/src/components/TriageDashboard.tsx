import React from "react";
import SignalCard from "@/components/SignalCard";
import type { TriageVerdict } from "@/SovereignLogic";

interface TriageDashboardProps {
  lectin: number;
  vascularAsymmetry: number;
  emf: number;
  acousticBpm: number;
  acousticState: string;
  heartRate: number;
  bloodGroup?: string;
  verdict: TriageVerdict;
  onChangeLectin: (v: number) => void;
  onChangeVascular: (v: number) => void;
  onChangeEmf: (v: number) => void;
  onChangeAcoustic: (v: number) => void;
}

const sev = (x: number): "stable" | "elevated" | "critical" => {
  if (x >= 0.7) return "critical";
  if (x >= 0.4) return "elevated";
  return "stable";
};

const TriageDashboard: React.FC<TriageDashboardProps> = ({
  lectin,
  vascularAsymmetry,
  emf,
  acousticBpm,
  acousticState,
  heartRate,
  bloodGroup,
  verdict,
  onChangeLectin,
  onChangeVascular,
  onChangeEmf,
  onChangeAcoustic,
}) => {
  return (
    <section data-testid="triage-dashboard">
      <div className="bo-dashboard">
        <SignalCard
          label="Lectin Spike"
          channel="CH · 01 · GUT/BLOOD"
          value={(lectin * 100).toFixed(0)}
          unit="%"
          intensity={lectin}
          severity={sev(lectin)}
          footnote={bloodGroup ? `Cross-ref · ${bloodGroup}` : "Cross-ref · ABO pending"}
          testId="signal-lectin"
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={lectin}
            onChange={(e) => onChangeLectin(parseFloat(e.target.value))}
            className="bo-slider"
            data-testid="slider-lectin"
            aria-label="Lectin spike intensity"
          />
        </SignalCard>

        <SignalCard
          label="Vascular Asymmetry"
          channel="CH · 02 · PPG (PENDING)"
          value={(vascularAsymmetry * 100).toFixed(0)}
          unit="%"
          intensity={vascularAsymmetry}
          severity={sev(vascularAsymmetry)}
          footnote="Crack #2 · camera + flash will replace this slider"
          testId="signal-vascular"
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vascularAsymmetry}
            onChange={(e) => onChangeVascular(parseFloat(e.target.value))}
            className="bo-slider"
            data-testid="slider-vascular"
            aria-label="Vascular asymmetry intensity (placeholder for PPG)"
          />
        </SignalCard>

        <SignalCard
          label="EMF Stealth"
          channel="CH · 03 · MAGNETOMETER"
          value={(emf * 100).toFixed(0)}
          unit="µT-norm"
          intensity={emf}
          severity={sev(emf)}
          footnote="Crack #2 · sensor wiring"
          testId="signal-emf"
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={emf}
            onChange={(e) => onChangeEmf(parseFloat(e.target.value))}
            className="bo-slider"
            data-testid="slider-emf"
            aria-label="EMF stealth interference"
          />
        </SignalCard>

        <SignalCard
          label="Stomach Acoustic"
          channel="CH · 04 · MIC"
          value={acousticBpm.toFixed(1)}
          unit="events/min"
          intensity={Math.min(1, acousticBpm / 30)}
          severity={
            acousticState === "lectin-irritation" || acousticState === "obstruction-suspect"
              ? "critical"
              : acousticState === "hyperactive"
              ? "elevated"
              : "stable"
          }
          footnote={`State · ${acousticState}`}
          testId="signal-acoustic"
        >
          <input
            type="range"
            min={0}
            max={40}
            step={0.5}
            value={acousticBpm}
            onChange={(e) => onChangeAcoustic(parseFloat(e.target.value))}
            className="bo-slider"
            data-testid="slider-acoustic"
            aria-label="Stomach acoustic events per minute"
          />
        </SignalCard>
      </div>

      <div className={`bo-verdict level-${verdict.level}`} data-testid="triage-verdict">
        <span className="score">
          SCORE · {verdict.score.toFixed(1)} / 100 · HR {heartRate ? `${Math.round(heartRate)} BPM` : "—"}
        </span>
        <span className="level" data-testid="triage-verdict-level">{verdict.level.replace("-", " ")}</span>
        <div className="directive" data-testid="triage-verdict-directive">{verdict.directive}</div>
        {verdict.flags.length > 0 && (
          <div className="bo-flags" data-testid="triage-verdict-flags">
            {verdict.flags.map((f) => (
              <span
                key={f}
                className={`bo-flag ${
                  f.includes("critical") || f.includes("bleeding") ? "danger" : ""
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TriageDashboard;
