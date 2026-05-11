import React, { useEffect, useState } from "react";
import "@/styles/bioracle.css";
import Dashboard, { type TileKey, type Profile } from "@/scenes/Dashboard";
import MedicalRitual from "@/scenes/MedicalRitual";
import DigestionScene from "@/scenes/DigestionScene";
import EmergencyScene from "@/scenes/EmergencyScene";
import StealthScene from "@/scenes/StealthScene";
import LiquidBatteryFullscreen from "@/scenes/LiquidBatteryFullscreen";
import CruiseScene from "@/scenes/CruiseScene";
import BeautyScene from "@/scenes/BeautyScene";
import { useMagnetometer } from "@/hardware/useMagnetometer";
import { useIntent } from "@/hardware/useIntent";
import { useHaptics } from "@/hardware/useHaptics";
import { useSwipeGesture } from "@/hardware/useSwipeGesture";
import { useAutoStealth } from "@/hardware/useAutoStealth";

type Scene = "dashboard" | TileKey | "vial";

const ACCENTS: Record<TileKey, string> = {
  medical:   "#6dc4dd",
  digestion: "#f5a623",
  emergency: "#ff5b50",
  stealth:   "#cfcfd9",
  cruise:    "#c0ff00",
  beauty:    "#ff9bb3",
};

const PROFILE_KEY = "bo.profile.v14";

function App() {
  const [scene, setScene] = useState<Scene>("dashboard");
  const [profile, setProfileState] = useState<Profile>(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(PROFILE_KEY)) as Profile | null;
    return stored === "cruise" || stored === "beauty" || stored === "sovereign" ? stored : "sovereign";
  });

  const setProfile = (p: Profile) => {
    setProfileState(p);
    try { localStorage.setItem(PROFILE_KEY, p); } catch {}
    haptics.heavyClick();
  };

  const haptics = useHaptics(true);
  const mag = useMagnetometer();
  const intent = useIntent(mag.state.active ? mag.state.microtesla : null);
  const autoStealth = useAutoStealth(intent.autoStealthEngaged);

  // industrial-thump for Cruise = stacked vibration burst (harsher than soft thump)
  const industrialThump = () => {
    if (!haptics.supported) return;
    navigator.vibrate([24, 12, 60]);
  };

  // auto-start magnetometer (universal stealth across profiles)
  useEffect(() => {
    if (mag.state.available && !mag.state.active) mag.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mag.state.available]);

  // critical haptic when stealth engages
  const lastStealthRef = React.useRef(false);
  useEffect(() => {
    if (intent.stealthEngaged && !lastStealthRef.current) {
      haptics.criticalBuzz();
    }
    lastStealthRef.current = intent.stealthEngaged;
  }, [intent.stealthEngaged, haptics]);

  useSwipeGesture(
    (dir) => {
      if (scene === "dashboard" && dir === "down") {
        haptics.softTap();
        setScene("vial");
      } else if (scene === "vial" && dir === "up") {
        setScene("dashboard");
      }
    },
    { threshold: 70, enabled: scene === "dashboard" || scene === "vial" },
  );

  const openTile = (k: TileKey) => {
    haptics.softTap();
    setScene(k);
  };
  const back = () => {
    haptics.softTap();
    setScene("dashboard");
  };

  const dashboardChip = {
    charge: intent.stealthEngaged ? 28 : 92,
    bpm: 0,
    level: intent.stealthEngaged ? "critical" : "stable",
  };

  return (
    <div
      className={`bo-app v14 ${intent.stealthEngaged ? "stealth-engaged-app" : ""} ${autoStealth.active ? "auto-stealth-active" : ""}`}
      data-profile={profile}
      data-auto-stealth={autoStealth.active ? "true" : "false"}
      data-testid="bioracle-root"
    >
      {/* Auto-Stealth Ghost Silver ripple — proactive protection overlay */}
      {autoStealth.active && (
        <div className="bo-ghost-ripple" data-testid="ghost-ripple" aria-hidden>
          <span className="r r1" />
          <span className="r r2" />
          <span className="r r3" />
          <span className="r r4" />
          <span className="ghost-pill">
            <span className="dot" />
            AUTO-STEALTH · {Math.round((Date.now() - autoStealth.engagedSince) / 1000)}s · {autoStealth.runtime}
          </span>
        </div>
      )}

      {/* Reactive Universal Stealth — fires on EMF spike + intent (V13 behaviour) */}
      {intent.stealthEngaged && (
        <div className="bo-universal-stealth" data-testid="universal-stealth-banner">
          <span className="dot" />
          <span className="lbl">UNIVERSAL STEALTH · {mag.state.microtesla.toFixed(1)} µT · intent {intent.intent.toFixed(2)}</span>
        </div>
      )}

      {scene === "dashboard" && (
        <Dashboard
          onOpen={openTile}
          profile={profile}
          setProfile={setProfile}
          health={dashboardChip}
          stealthEngaged={intent.stealthEngaged}
        />
      )}

      {scene === "medical" && (
        <MedicalRitual
          accent={ACCENTS.medical}
          onClose={back}
          lectinSignature={0}
          emfMicrotesla={mag.state.microtesla}
          syntheticInterference={mag.state.syntheticInterference}
          haptic={profile === "cruise" ? industrialThump : haptics.thump}
          profile={profile}
        />
      )}

      {scene === "digestion" && (
        <DigestionScene accent={ACCENTS.digestion} onClose={back} />
      )}

      {scene === "emergency" && (
        <EmergencyScene
          accent={ACCENTS.emergency}
          onClose={back}
          haptic={profile === "cruise" ? industrialThump : haptics.thump}
          lectinSignature={0}
          emfMicrotesla={mag.state.microtesla}
          syntheticInterference={mag.state.syntheticInterference}
        />
      )}

      {scene === "stealth" && <StealthScene accent={ACCENTS.stealth} onClose={back} autoStealth={autoStealth} intent={intent} />}

      {scene === "cruise" && (
        <CruiseScene accent={ACCENTS.cruise} onClose={back} industrialThump={industrialThump} />
      )}

      {scene === "beauty" && (
        <BeautyScene accent={ACCENTS.beauty} onClose={back} />
      )}

      {scene === "vial" && (
        <LiquidBatteryFullscreen
          charge={dashboardChip.charge}
          heartRate={dashboardChip.bpm}
          severity={dashboardChip.level as any}
          ppgAmplitude={0}
          syntheticInterference={mag.state.syntheticInterference}
          emfMicrotesla={mag.state.microtesla}
          lastBeatTs={0}
          onClose={() => { haptics.softTap(); setScene("dashboard"); }}
        />
      )}
    </div>
  );
}

export default App;
