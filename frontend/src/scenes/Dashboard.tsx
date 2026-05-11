import React from "react";

export type TileKey = "medical" | "digestion" | "emergency" | "stealth" | "cruise" | "beauty";
export type Profile = "sovereign" | "cruise" | "beauty";

interface TileMeta {
  key: TileKey;
  label: string;
  sub: string;
  accent: string;
  glyph: React.ReactNode;
  showIn: Profile[];
}

export const TILES: TileMeta[] = [
  {
    key: "medical",
    label: "Medical",
    sub: "Retinol · Tongue · Blood · Banter",
    accent: "#6dc4dd",
    showIn: ["sovereign", "cruise", "beauty"],
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
    showIn: ["sovereign", "cruise", "beauty"],
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
    showIn: ["sovereign", "cruise", "beauty"],
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
    sub: "EMF · Intent · Universal",
    accent: "#cfcfd9",
    showIn: ["sovereign", "cruise", "beauty"],
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3l8 4v6c0 4.5-3.5 7-8 8-4.5-1-8-3.5-8-8V7l8-4z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "cruise",
    label: "Anabolic",
    sub: "Post-Set HRV · Window",
    accent: "#c0ff00",
    showIn: ["cruise"],
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 17l5-5 4 4 9-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 7h7v7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "beauty",
    label: "Glow",
    sub: "Sub-Dermal Oxygenation",
    accent: "#ff9bb3",
    showIn: ["beauty"],
    glyph: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface DashboardProps {
  onOpen: (k: TileKey) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  health?: { charge: number; bpm: number; level: string };
  stealthEngaged?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onOpen, profile, setProfile, health, stealthEngaged }) => {
  const visible = TILES.filter((t) => t.showIn.includes(profile));
  const profileLabel: Record<Profile, string> = {
    sovereign: "Sovereign",
    cruise: "Bio Cruise",
    beauty: "Bio Beauty",
  };

  return (
    <div className="bo-dash" data-testid="dashboard">
      <header className="bo-dash-header">
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">{profileLabel[profile]}</h1>
        <span className="tagline">
          V14 · {profile} · {health?.level || "stable"}
          {health?.bpm ? ` · ${Math.round(health.bpm)} bpm` : ""}
          {stealthEngaged && " · contextual stealth engaged"}
        </span>

        <div className="bo-profile-switcher" data-testid="profile-switcher">
          {(["sovereign","cruise","beauty"] as Profile[]).map((p) => (
            <button
              key={p}
              className={`chip chip-${p} ${profile === p ? "on" : ""}`}
              onClick={() => setProfile(p)}
              data-testid={`profile-${p}`}
            >
              {p === "sovereign" ? "Sovereign" : p === "cruise" ? "Cruise" : "Beauty"}
            </button>
          ))}
        </div>

        <span className="bo-swipe-hint">↓ swipe down · sovereign vial</span>
      </header>

      <div className="bo-bento" data-testid="bento">
        {visible.map((t) => (
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
        Tap a tile · the rest vanishes · Stealth runs universal
      </footer>
    </div>
  );
};

export default Dashboard;
