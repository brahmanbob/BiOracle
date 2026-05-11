import React from "react";
import LiquidVialBattery from "@/components/LiquidVialBattery";

interface Props {
  charge: number;
  heartRate: number;
  severity: "stable" | "monitor" | "elevated" | "critical" | "sovereign-override";
  ppgAmplitude: number;
  syntheticInterference: boolean;
  emfMicrotesla: number;
  lastBeatTs: number;
  onClose: () => void;
}

const LiquidBatteryFullscreen: React.FC<Props> = (props) => {
  return (
    <div className="bo-vial-fullscreen" onClick={props.onClose} data-testid="vial-fullscreen">
      <button className="bo-back floating" onClick={props.onClose} data-testid="btn-vial-close">← swipe up · close</button>
      <div className="bo-vial-stage">
        <LiquidVialBattery
          charge={props.charge}
          heartRate={props.heartRate}
          severity={props.severity}
          ppgAmplitude={props.ppgAmplitude}
          syntheticInterference={props.syntheticInterference}
          emfMicrotesla={props.emfMicrotesla}
          lastBeatTs={props.lastBeatTs}
        />
      </div>
      <span className="bo-vial-caption">SOVEREIGN VESSEL · the body's charge made visible</span>
    </div>
  );
};

export default LiquidBatteryFullscreen;
