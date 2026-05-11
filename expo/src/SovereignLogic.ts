// BIORACLE V12 - SOVEREIGN LOGIC (TypeScript)
// Pure functions, shared between React web preview and React Native / Expo.

export type FingerprintPattern = 'loop' | 'whorl' | 'arch';
export type BloodType = 'O' | 'A' | 'B';

export const inferBloodType = (pattern: FingerprintPattern | string): BloodType => {
  const map: Record<string, BloodType> = { loop: 'O', whorl: 'A', arch: 'B' };
  return map[pattern] || 'O';
};

export interface AcousticResult {
  status: string;
  level: 'High' | 'Critical' | 'Stable';
}

export const analyzeAcoustics = (intensity: number): AcousticResult => {
  if (intensity > 0.8) return { status: 'Lectin Inflammation', level: 'High' };
  if (intensity < 0.3) return { status: 'MMC Stagnation', level: 'Critical' };
  return { status: 'Digestive Rhythm: Optimal', level: 'Stable' };
};

export const emergencyTriage = (asymmetry: number): string => {
  if (asymmetry > 0.3) return 'CRITICAL: Internal Hemorrhage Suspected';
  return 'Vascular Integrity: Stable';
};

export const stealthMode = (rssi: number): string => {
  return rssi > -50
    ? 'EMF Signature High - Shielding Active'
    : 'Stealth Optimized';
};

export interface BatteryInputs {
  acousticIntensity?: number;
  triageAsymmetry?: number;
  rssi?: number;
}

export const computeBatteryScore = ({
  acousticIntensity = 0.55,
  triageAsymmetry = 0.0,
  rssi = -70,
}: BatteryInputs): number => {
  const acoustic = analyzeAcoustics(acousticIntensity);
  let score = 100;
  if (acoustic.status.includes('Lectin')) score -= 45;
  else if (acoustic.status.includes('MMC')) score -= 55;
  else score -= Math.abs(acousticIntensity - 0.55) * 40;

  if (triageAsymmetry > 0.3) score -= 35;
  else score -= triageAsymmetry * 20;

  if (rssi > -50) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
};
