import React from "react";

interface SignalCardProps {
  label: string;
  channel: string;
  value: string | number;
  unit?: string;
  /** 0..1 used to drive the inline bar */
  intensity: number;
  severity?: "stable" | "elevated" | "critical";
  footnote?: string;
  children?: React.ReactNode;
  testId?: string;
}

const SignalCard: React.FC<SignalCardProps> = ({
  label,
  channel,
  value,
  unit,
  intensity,
  severity = "stable",
  footnote,
  children,
  testId,
}) => {
  const pct = Math.round(Math.max(0, Math.min(1, intensity)) * 100);
  return (
    <div className={`bo-card severity-${severity}`} data-testid={testId}>
      <div className="head">
        <span className="label">{label}</span>
        <span className="channel">{channel}</span>
      </div>
      <div>
        <span className="value" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </span>
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
      {children}
      {footnote ? <div className="footnote">{footnote}</div> : null}
    </div>
  );
};

export default SignalCard;
