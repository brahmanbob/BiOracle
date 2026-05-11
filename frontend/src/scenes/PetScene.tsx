import React from "react";
import { usePetAcoustic, type PetSpecies } from "@/hardware/usePetAcoustic";

interface Props {
  accent: string;
  onClose: () => void;
}

const SPECIES_COPY: Record<PetSpecies, { label: string; calm: string; watch: string; distress: string }> = {
  dog: {
    label: "Canine",
    calm: "Your dog sounds settled. Posture and water bowl checked — keep the rhythm.",
    watch: "Some low rumble in the 200–700 Hz band. Offer water, gentle belly check, observe 10 min.",
    distress: "Sustained whine + abdominal rumble. Look for distended belly, restless pacing, dry retching — call your vet's line.",
  },
  cat: {
    label: "Feline",
    calm: "Your cat sounds peaceful. Slow blinks, soft breathing — all good.",
    watch: "Higher-pitched vocal energy than baseline. Check litter box, food, hiding spots quietly.",
    distress: "Yowling pattern present. If hiding + not eating > 12 h or distended belly: vet call.",
  },
};

const PetScene: React.FC<Props> = ({ accent, onClose }) => {
  const pet = usePetAcoustic("dog");
  const copy = SPECIES_COPY[pet.state.species];
  const tier = pet.state.state;
  const calibrating = pet.state.active && pet.state.calibration.phase === "calibrating";
  const banter =
    !pet.state.active ? "Mic idle. Place phone within 1 m of the pet, low ambient noise." :
    calibrating ? "Silent check in progress — measuring the room so we can read the animal, not the room." :
    tier === "distress" ? copy.distress :
    tier === "watch" ? copy.watch : copy.calm;

  return (
    <div className="bo-immersion profile-pet" style={{ ["--accent" as any]: accent }} data-testid="pet-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { pet.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">BIO·PET · ACOUSTIC TRIAGE</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card pet">
          <h2 className="bo-step-title">{copy.label} Acoustic Watch</h2>
          <p className="bo-step-instructions">
            Calibrated for species-specific distress bands. Sub-150 Hz rumble flags abdominal stress; vocal-band spikes flag pain or anxiety.
          </p>

          <div className="bo-mode-switch" data-testid="pet-species-switch">
            <button
              className={pet.state.species === "dog" ? "on" : ""}
              onClick={() => pet.setSpecies("dog")}
              data-testid="btn-pet-dog"
            >DOG</button>
            <button
              className={pet.state.species === "cat" ? "on" : ""}
              onClick={() => pet.setSpecies("cat")}
              data-testid="btn-pet-cat"
            >CAT</button>
          </div>

          {pet.state.active && pet.state.calibration.phase === "calibrating" && (
            <div className="bo-noise-floor calibrating" data-testid="pet-noise-floor">
              <span className="lbl">SILENT CHECK · NOISE FLOOR</span>
              <div className="bar"><span style={{ width: `${Math.min(100, (pet.state.calibration.elapsedSec / 3) * 100)}%` }} /></div>
              <span className="hint">Keep the room quiet for 3 seconds while we measure ambient noise to subtract from the scan.</span>
            </div>
          )}
          {pet.state.active && pet.state.calibration.phase === "ready" && (
            <div className="bo-noise-floor ready" data-testid="pet-noise-floor-ready">
              <span className="lbl">NOISE FLOOR LOCKED</span>
              <span className="vals">
                rms <b>{pet.state.calibration.noiseFloorRms.toFixed(4)}</b> ·
                vocal <b>{(pet.state.calibration.noiseFloorVocal * 100).toFixed(0)}%</b> ·
                rumble <b>{(pet.state.calibration.noiseFloorRumble * 100).toFixed(0)}%</b>
              </span>
            </div>
          )}

          <div className="bo-pet-readout" data-testid="pet-readout">
            <div className={`tier tier-${tier}`}>
              <span className="lbl">STATE</span>
              <b>{tier.toUpperCase()}</b>
            </div>
            <div className="rows">
              <div className="row"><span>Vocal band</span><b>{(pet.state.vocalBand * 100).toFixed(0)}%</b></div>
              <div className="row"><span>Sub-rumble (bloat)</span><b>{(pet.state.subRumble * 100).toFixed(0)}%</b></div>
              <div className="row"><span>Silent frames</span><b>{(pet.state.silenceRatio * 100).toFixed(0)}%</b></div>
              <div className="row"><span>Stress score</span><b>{(pet.state.stressScore * 100).toFixed(0)}/100</b></div>
            </div>
          </div>

          <div className="bo-pet-banter" data-testid="pet-banter">{banter}</div>

          {pet.state.permissionError && <p className="bo-error">⚠︎ {pet.state.permissionError}</p>}

          <div className="bo-step-controls">
            {!pet.state.active ? (
              <button className="bo-glass-btn primary" onClick={pet.start} data-testid="btn-pet-start">Open Mic Watch</button>
            ) : (
              <button className="bo-glass-btn" onClick={pet.stop} data-testid="btn-pet-stop">■ Stop</button>
            )}
            <button className="bo-glass-btn" onClick={() => { pet.stop(); onClose(); }} data-testid="btn-pet-done">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetScene;
