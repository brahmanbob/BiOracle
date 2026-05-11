// BIORACLE V12 - SOVEREIGN LOGIC (ported from SovereignLogic.ts)
// Pure functions, no side-effects. Shared between web preview and Expo source.

export const inferBloodType = (pattern) => {
  const map = { loop: 'O', whorl: 'A', arch: 'B' };
  return map[pattern] || 'O';
};

export const analyzeAcoustics = (intensity) => {
  if (intensity > 0.8) return { status: 'Lectin Inflammation', level: 'High' };
  if (intensity < 0.3) return { status: 'MMC Stagnation', level: 'Critical' };
  return { status: 'Digestive Rhythm: Optimal', level: 'Stable' };
};

export const emergencyTriage = (asymmetry) => {
  if (asymmetry > 0.3) return 'CRITICAL: Internal Hemorrhage Suspected';
  return 'Vascular Integrity: Stable';
};

export const stealthMode = (rssi) => {
  return rssi > -50
    ? 'EMF Signature High - Shielding Active'
    : 'Stealth Optimized';
};

// Battery score helper — converts current sovereign state into a 0-100 charge.
export const computeBatteryScore = ({ acousticIntensity = 0.55, triageAsymmetry = 0.0, rssi = -70 }) => {
  const acoustic = analyzeAcoustics(acousticIntensity);
  let score = 100;
  if (acoustic.status.includes('Lectin')) score -= 45;
  else if (acoustic.status.includes('MMC')) score -= 55;
  else score -= Math.abs(acousticIntensity - 0.55) * 40;

  if (triageAsymmetry > 0.3) score -= 35;
  else score -= triageAsymmetry * 20;

  if (rssi > -50) score -= 8; // EMF stress
  return Math.max(0, Math.min(100, Math.round(score)));
};
