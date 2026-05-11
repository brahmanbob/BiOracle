import React, { useMemo } from "react";

interface HealthBatteryProps {
  /** 0..100 — overall sovereign health charge */
  charge: number;
  /** Heart rate (bpm) — controls glow pulse frequency. 0 = idle pulse. */
  heartRate?: number;
  /** Triage state colour cue */
  severity?: "stable" | "monitor" | "elevated" | "critical" | "sovereign-override";
  /** Override pulse intensity (e.g. while scanning). 0..1 */
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
  scanIntensity = 0,
}) => {
  const clamped = Math.max(0, Math.min(100, charge));
  const fillHeight = (clamped / 100) * 240; // inner cavity height

  // Pulse duration: heart rate maps directly. If no HR → fall back to a slow ambient.
  // 60_000 / bpm gives ms per beat.
  const pulseDurationMs = useMemo(() => {
    if (heartRate && heartRate > 30 && heartRate < 220) {
      return Math.round(60000 / heartRate);
    }
    // Scan-intensity nudges the idle pulse faster as scan ramps up.
    return Math.round(1400 - scanIntensity * 600);
  }, [heartRate, scanIntensity]);

  const glow = SEVERITY_GLOW[severity];

  return (
    <div className="bo-battery-wrap" data-testid="health-battery">
      <div
        className="bo-battery"
        style={{ filter: `drop-shadow(0 0 22px ${glow})` }}
        data-testid="health-battery-frame"
      >
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

          {/* terminal cap */}
          <rect x="80" y="6" width="40" height="14" rx="3" fill="url(#bo-bezel)" />

          {/* outer obsidian shell */}
          <rect
            x="30"
            y="22"
            width="140"
            height="270"
            rx="18"
            fill="url(#bo-obsidian)"
            stroke="url(#bo-bezel)"
            strokeWidth="2.5"
          />

          {/* inner cavity */}
          <rect
            x="42"
            y="34"
            width="116"
            height="246"
            rx="10"
            fill="#080810"
            stroke="#2a2a35"
            strokeWidth="1"
          />

          {/* gold fill (charge level) */}
          <rect
            className="fill-bar"
            x="46"
            y={38 + (240 - fillHeight)}
            width="108"
            height={fillHeight}
            rx="6"
            fill="url(#bo-gold)"
            opacity="0.92"
          />

          {/* pulsing ring overlay — frequency = heart rate */}
          <circle
            className="pulse-ring"
            cx="100"
            cy={Math.max(60, 280 - fillHeight + 20)}
            r="44"
            fill="url(#bo-glow)"
            style={{
              animationDuration: `${pulseDurationMs}ms`,
            }}
            data-testid="health-battery-pulse"
          />

          {/* ridge marks */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1="46"
              x2="154"
              y1={38 + 240 * (1 - t)}
              y2={38 + 240 * (1 - t)}
              stroke="#2a2a35"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          ))}

          {/* engraving */}
          <text
            x="100"
            y="296"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, serif"
            fontSize="9"
            letterSpacing="6"
            fill="#6b6555"
          >
            SOVEREIGN
          </text>
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
