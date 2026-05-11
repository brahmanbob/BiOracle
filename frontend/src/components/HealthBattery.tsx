import React, { useEffect, useMemo, useRef } from "react";

interface HealthBatteryProps {
  /** 0..100 — overall sovereign health charge */
  charge: number;
  /** Heart rate (bpm) — controls glow pulse frequency. 0 = idle pulse. */
  heartRate?: number;
  /** Triage state colour cue */
  severity?: "stable" | "monitor" | "elevated" | "critical" | "sovereign-override";
  /** 0..1 live PPG signal amplitude — drives the flicker intensity of the glow */
  ppgAmplitude?: number;
  /** True when magnetometer > 65 µT (synthetic interference detected) */
  syntheticInterference?: boolean;
  /** Optional µT readout for the badge subtitle */
  emfMicrotesla?: number;
  /** scan progress 0..1 — used as fallback when no HR */
  scanIntensity?: number;
}

const SEVERITY_GLOW: Record<NonNullable<HealthBatteryProps["severity"]>, string> = {
  stable: "rgba(255, 217, 102, 0.55)",
  monitor: "rgba(255, 217, 102, 0.65)",
  elevated: "rgba(245, 166, 35, 0.75)",
  critical: "rgba(255, 59, 59, 0.8)",
  "sovereign-override": "rgba(255, 59, 59, 0.95)",
};

const HealthBattery: React.FC<HealthBatteryProps> = ({
  charge,
  heartRate = 0,
  severity = "stable",
  ppgAmplitude = 0,
  syntheticInterference = false,
  emfMicrotesla,
  scanIntensity = 0,
}) => {
  const clamped = Math.max(0, Math.min(100, charge));
  const fillHeight = (clamped / 100) * 240;

  const pulseDurationMs = useMemo(() => {
    if (heartRate && heartRate > 30 && heartRate < 220) {
      return Math.round(60000 / heartRate);
    }
    return Math.round(1400 - scanIntensity * 600);
  }, [heartRate, scanIntensity]);

  const glow = SEVERITY_GLOW[severity];

  // Flicker intensity from PPG amplitude → drop-shadow blur scales 16px..40px
  const blurPx = 16 + Math.round(ppgAmplitude * 24);

  // Quick decay/flicker via animated dropShadow recalculated each tick
  const flickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = flickerRef.current;
    if (!el) return;
    let raf = 0;
    const animate = () => {
      // sin-based jitter modulated by amplitude
      const phase = (performance.now() / pulseDurationMs) * 2 * Math.PI;
      const jitter = (Math.sin(phase) + 1) / 2; // 0..1
      const intensity = 0.6 + jitter * 0.4 + ppgAmplitude * 0.6;
      el.style.filter = `drop-shadow(0 0 ${blurPx * Math.min(1.4, intensity)}px ${glow})`;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [pulseDurationMs, blurPx, glow, ppgAmplitude]);

  return (
    <div className="bo-battery-wrap" data-testid="health-battery">
      <div className="bo-battery" ref={flickerRef} data-testid="health-battery-frame">
        {syntheticInterference && (
          <div className="bo-emf-badge" data-testid="emf-badge">
            <span className="dot" />
            <span className="lbl">SYNTHETIC INTERFERENCE</span>
            {typeof emfMicrotesla === "number" && (
              <span className="sub">{emfMicrotesla.toFixed(1)} µT</span>
            )}
          </div>
        )}
        <svg viewBox="0 0 200 300" aria-label="Sovereign health battery">
          <defs>
            <linearGradient id="bo-obsidian" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1c1c24" />
              <stop offset="100%" stopColor="#050507" />
            </linearGradient>
            <linearGradient id="bo-gold" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#8a6a16" />
              <stop offset="55%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#ffd966" />
            </linearGradient>
            <linearGradient id="bo-bezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="50%" stopColor="#8a6a16" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>
            <radialGradient id="bo-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={glow} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <rect x="80" y="6" width="40" height="14" rx="3" fill="url(#bo-bezel)" />
          <rect x="30" y="22" width="140" height="270" rx="18" fill="url(#bo-obsidian)" stroke="url(#bo-bezel)" strokeWidth="2.5" />
          <rect x="42" y="34" width="116" height="246" rx="10" fill="#080810" stroke="#2a2a35" strokeWidth="1" />
          <rect className="fill-bar" x="46" y={38 + (240 - fillHeight)} width="108" height={fillHeight} rx="6" fill="url(#bo-gold)" opacity="0.92" />
          <circle
            className="pulse-ring"
            cx="100"
            cy={Math.max(60, 280 - fillHeight + 20)}
            r="44"
            fill="url(#bo-glow)"
            style={{ animationDuration: `${pulseDurationMs}ms` }}
            data-testid="health-battery-pulse"
          />
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1="46" x2="154" y1={38 + 240 * (1 - t)} y2={38 + 240 * (1 - t)} stroke="#2a2a35" strokeDasharray="3 4" strokeWidth="1" />
          ))}
          <text x="100" y="296" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="9" letterSpacing="6" fill="#6b6555">SOVEREIGN</text>
        </svg>
      </div>

      <div className="bo-battery-readout">
        <span className="pct" data-testid="health-battery-pct">{Math.round(clamped)}%</span>
        <span className="bpm" data-testid="health-battery-bpm">
          {heartRate ? `${Math.round(heartRate)} BPM` : "idle pulse"}
        </span>
      </div>
    </div>
  );
};

export default HealthBattery;
