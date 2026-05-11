import React, { useEffect, useState } from "react";
import "@/styles/bioracle.css";
import Dashboard, { type TileKey } from "@/scenes/Dashboard";
import MedicalRitual from "@/scenes/MedicalRitual";
import DigestionScene from "@/scenes/DigestionScene";
import EmergencyScene from "@/scenes/EmergencyScene";
import StealthScene from "@/scenes/StealthScene";
import LiquidBatteryFullscreen from "@/scenes/LiquidBatteryFullscreen";
import { useMagnetometer } from "@/hardware/useMagnetometer";
import { useIntent } from "@/hardware/useIntent";
import { useHaptics } from "@/hardware/useHaptics";
import { useSwipeGesture } from "@/hardware/useSwipeGesture";

type Scene = "dashboard" | TileKey | "vial";

const ACCENTS: Record<TileKey, string> = {
  medical:   "#6dc4dd",
  digestion: "#f5a623",
  emergency: "#ff5b50",
  stealth:   "#cfcfd9",
};

function App() {
  const [scene, setScene] = useState<Scene>("dashboard");
  const haptics = useHaptics(true);

  // Ambient sensors (only mag is global — for contextual stealth + dashboard chip)
  const mag = useMagnetometer();
  const intent = useIntent(mag.state.active ? mag.state.microtesla : null);

  // Auto-start magnetometer once, silently (best-effort, can fail in iframe)
  useEffect(() => {
    if (mag.state.available && !mag.state.active) {
      mag.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mag.state.available]);

  // Swipe-down anywhere on dashboard → opens fullscreen vial
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

  // Battery-stat fed into fullscreen vial — derived from mag for now
  const dashboardChip = {
    charge: intent.stealthEngaged ? 28 : 92,
    bpm: 0,
    level: intent.stealthEngaged ? "critical" : "stable",
  };

  return (
    <div className={`bo-app v13 ${intent.stealthEngaged ? "stealth-engaged-app" : ""}`} data-testid="bioracle-root">
      {scene === "dashboard" && (
        <Dashboard
          onOpen={openTile}
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
          haptic={haptics.thump}
        />
      )}

      {scene === "digestion" && (
        <DigestionScene accent={ACCENTS.digestion} onClose={back} />
      )}

      {scene === "emergency" && (
        <EmergencyScene
          accent={ACCENTS.emergency}
          onClose={back}
          haptic={haptics.thump}
          lectinSignature={0}
          emfMicrotesla={mag.state.microtesla}
          syntheticInterference={mag.state.syntheticInterference}
        />
      )}

      {scene === "stealth" && (
        <StealthScene accent={ACCENTS.stealth} onClose={back} />
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
