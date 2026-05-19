// BiOracle RPPG Engine - Pure TypeScript
export type BiometricData = {
  hr: number;
  rmssd: number;
  sdnn: number;
  coherence: number;
  timestamp: number;
};

export class RPPGEngine {
  private callback: ((data: BiometricData) => void) | null = null;
  private isRunning: boolean = false;
  
  constructor(fps: number = 60) {
    console.log(`RPPG Engine ready at ${fps}fps`);
  }
  
  start(callback: (data: BiometricData) => void) {
    this.callback = callback;
    this.isRunning = true;
    this.simulateReadings();
  }
  
  stop() {
    this.isRunning = false;
  }
  
  private simulateReadings() {
    if (!this.isRunning) return;
    
    const data: BiometricData = {
      hr: 65 + Math.random() * 10,
      rmssd: 35 + Math.random() * 20,
      sdnn: 45 + Math.random() * 15,
      coherence: 0.6 + Math.random() * 0.3,
      timestamp: Date.now()
    };
    
    this.callback?.(data);
    setTimeout(() => this.simulateReadings(), 2000);
  }
}
