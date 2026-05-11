import React from "react";
import type { OcularPanel as OcularPanelData, ConfidenceTier } from "@/lib/ocularVitals";

interface Props {
  panel: OcularPanelData;
  onCalibrate?: () => void;
  hasCalibration?: boolean;
  onClearCalibration?: () => void;
}

const TIER_COLOR: Record<ConfidenceTier, string> = {
  high: "#9ad88a",
  medium: "#f5deb3",
  low: "#f5a623",
  untrusted: "#ff5b50",
};

const OcularPanel: React.FC<Props> = ({ panel, onCalibrate, hasCalibration, onClearCalibration }) => {
  return (
    <div className="bo-ocular-panel" data-testid="ocular-panel" data-confidence={panel.overallConfidence}>
      <div className="head">
        <span className="ribbon">⌖ NO-BS OCULAR PANEL</span>
        <span className="quality" style={{ color: TIER_COLOR[panel.overallConfidence] }}>
          signal {Math.round(panel.signalQuality * 100)}% · {panel.overallConfidence}
        </span>
      </div>

      <div className="vitals">
        <Vital v={panel.hr} />
        <VitalBP v={panel.bp} systolic={panel.bpSystolic} diastolic={panel.bpDiastolic} />
        <Vital v={panel.spo2} suffix="%" />
      </div>

      <p className="honesty" data-testid="ocular-honesty">{panel.honesty}</p>

      <div className="cal-strip">
        {hasCalibration ? (
          <>
            <span className="dot ok" /> Cuff calibration on file
            {onClearCalibration && (
              <button className="link" onClick={onClearCalibration} data-testid="btn-clear-cal">clear</button>
            )}
          </>
        ) : (
          <>
            <span className="dot warn" /> No cuff calibration — BP is uncalibrated
            {onCalibrate && (
              <button className="link" onClick={onCalibrate} data-testid="btn-add-cal">calibrate now</button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Vital: React.FC<{ v: OcularPanelData["hr"]; suffix?: string }> = ({ v, suffix }) => (
  <div className={`vital tag-${v.tag} tier-${v.tier}`}>
    <span className="lbl">{v.label}</span>
    <span className="val">
      <b>{v.value || "—"}</b>
      <em>{v.unit}{suffix || ""}</em>
    </span>
    <span className="tag" style={{ color: TIER_COLOR[v.tier] }}>
      {v.tag.toUpperCase()} · {v.tier}
    </span>
    <span className="rationale">{v.rationale}</span>
  </div>
);

const VitalBP: React.FC<{ v: OcularPanelData["bp"]; systolic: number; diastolic: number }> = ({ v, systolic, diastolic }) => (
  <div className={`vital tag-${v.tag} tier-${v.tier}`}>
    <span className="lbl">{v.label}</span>
    <span className="val">
      <b>{systolic || "—"}<small> / {diastolic || "—"}</small></b>
      <em>{v.unit}</em>
    </span>
    <span className="tag" style={{ color: TIER_COLOR[v.tier] }}>
      {v.tag.toUpperCase()} · {v.tier}
    </span>
    <span className="rationale">{v.rationale}</span>
  </div>
);

export default OcularPanel;
