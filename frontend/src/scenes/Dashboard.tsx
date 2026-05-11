import React from "react";

export type TileKey = "medical" | "digestion" | "emergency" | "stealth";

interface TileMeta {
  key: TileKey;
  label: string;
  sub: string;
  accent: string;
  glyph: React.ReactNode;
}

export const TILES: TileMeta[] = [
  {
    key: "medical",
    label: "Medical",
    sub: "Retinol · Tongue · Blood · Banter",
    accent: "#6dc4dd",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "digestion",
    label: "Digestion",
    sub: "Mic · Lectin · MMC Spectrogram",
    accent: "#f5a623",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 6c3-3 11-3 14 0M5 12c3-3 11-3 14 0M5 18c3-3 11-3 14 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "emergency",
    label: "Emergency",
    sub: "PPG · Vascular · Bleeding · PDF",
    accent: "#ff5b50",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3v10M6 12l6 8 6-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="6" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: "stealth",
    label: "Stealth",
    sub: "EMF · Intent · Contextual",
    accent: "#cfcfd9",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3l8 4v6c0 4.5-3.5 7-8 8-4.5-1-8-3.5-8-8V7l8-4z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface DashboardProps {
  onOpen: (k: TileKey) => void;
  health?: { charge: number; bpm: number; level: string };
  stealthEngaged?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onOpen, health, stealthEngaged }) => {
  return (
    <div className="bo-dash" data-testid="dashboard">
      <header className="bo-dash-header">
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">Sovereign Ritual</h1>
        <span className="tagline">
          V13 · Bento · {health?.level || "stable"}
          {health?.bpm ? ` · ${Math.round(health.bpm)} bpm` : ""}
          {stealthEngaged && " · contextual stealth engaged"}
        </span>
        <span className="bo-swipe-hint">↓ swipe down · sovereign vial</span>
      </header>

      <div className="bo-bento" data-testid="bento">
        {TILES.map((t) => (
          <button
            key={t.key}
            className={`bo-tile tile-${t.key}`}
            onClick={() => onOpen(t.key)}
            data-testid={`tile-${t.key}`}
            style={{ ["--accent" as any]: t.accent }}
            aria-label={`Open ${t.label}`}
          >
            <span className="glyph">{t.glyph}</span>
            <span className="lbl">{t.label}</span>
            <span className="sub">{t.sub}</span>
            <span className="rib" />
          </button>
        ))}
      </div>

      <footer className="bo-dash-footer">
        Tap a tile · the rest vanishes
      </footer>
    </div>
  );
};

export default Dashboard;
