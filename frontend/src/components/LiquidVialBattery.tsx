import React, { useEffect, useRef } from "react";

/**
 * LiquidVialBattery — 3D Glass vial with procedural gold liquid slosh.
 *
 * Rendering pipeline:
 *   1. Static glass cylinder (radial gradients + inner highlight strip)
 *   2. Liquid level animated to `charge` via spring (state in physicsRef)
 *   3. Two phase-shifted sine waves modulate the meniscus shape
 *      → "slosh". Tilt parameter adds horizontal lean.
 *   4. Per-frame gold gradient + caustic spotlight that pulses at HR
 *   5. PPG amplitude modulates wave amplitude (live flicker)
 *   6. Synthetic Interference: red rim flash + EMF lattice overlay
 */
export interface LiquidVialBatteryProps {
  /** 0..100 — target charge */
  charge: number;
  /** Heart rate bpm — controls slosh / caustic pulse frequency */
  heartRate?: number;
  severity?: "stable" | "monitor" | "elevated" | "critical" | "sovereign-override";
  /** 0..1 live PPG amplitude → slosh amplitude */
  ppgAmplitude?: number;
  /** µT > 65 → interference overlay + red rim */
  syntheticInterference?: boolean;
  emfMicrotesla?: number;
  /** -1..+1 tilt (e.g., from device orientation) */
  tilt?: number;
  /** ms since last detected PPG beat — used for caustic flash */
  lastBeatTs?: number;
}

const SEVERITY_GOLD: Record<NonNullable<LiquidVialBatteryProps["severity"]>, [string, string, string]> = {
  stable:               ["#8a6a16", "#d4af37", "#ffd966"],
  monitor:              ["#8a6a16", "#d4af37", "#ffe07a"],
  elevated:             ["#7a4d0a", "#d4892a", "#ffc266"],
  critical:             ["#641515", "#d44a3a", "#ff8a72"],
  "sovereign-override": ["#440a0a", "#c8302d", "#ff5b50"],
};

const LiquidVialBattery: React.FC<LiquidVialBatteryProps> = ({
  charge,
  heartRate = 0,
  severity = "stable",
  ppgAmplitude = 0,
  syntheticInterference = false,
  emfMicrotesla,
  tilt = 0,
  lastBeatTs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Mutable physics state (no React re-render per frame)
  const physicsRef = useRef({
    currentLevel: charge,    // % — eased toward `charge`
    waveOffset1: 0,
    waveOffset2: 0,
    sloshVelocity: 0,
    sloshOffset: 0,
    lastTilt: 0,
  });

  // Keep targets fresh on each render without re-mounting the canvas
  const propsRef = useRef({
    charge, heartRate, severity, ppgAmplitude, syntheticInterference,
    emfMicrotesla, tilt, lastBeatTs,
  });
  propsRef.current = {
    charge, heartRate, severity, ppgAmplitude, syntheticInterference,
    emfMicrotesla, tilt, lastBeatTs,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = 240;
    const cssH = 360;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let lastTs = performance.now();

    const draw = (ts: number) => {
      const dt = Math.min(50, ts - lastTs) / 1000;
      lastTs = ts;
      const p = propsRef.current;
      const ph = physicsRef.current;

      // ---- physics ----
      // ease level toward target
      ph.currentLevel += (p.charge - ph.currentLevel) * Math.min(1, dt * 4);

      // slosh: tilt change injects velocity (lateral momentum)
      const dTilt = p.tilt - ph.lastTilt;
      ph.lastTilt = p.tilt;
      ph.sloshVelocity += dTilt * 60;
      ph.sloshVelocity *= 0.94; // damping
      ph.sloshOffset += ph.sloshVelocity * dt;
      ph.sloshOffset -= ph.sloshOffset * dt * 2.5;

      // wave phase progression (heart-rate locked)
      const bpm = p.heartRate && p.heartRate > 30 ? p.heartRate : 30;
      const baseFreq = (bpm / 60) * 2 * Math.PI;
      ph.waveOffset1 += dt * baseFreq;
      ph.waveOffset2 += dt * baseFreq * 1.37;

      // ---- geometry ----
      const cx = cssW / 2;
      const vialTop = 36;
      const vialBottom = cssH - 32;
      const vialHeight = vialBottom - vialTop;
      const vialW = 120;

      // clear
      ctx.clearRect(0, 0, cssW, cssH);

      // ---- background subtle halo ----
      const haloGrad = ctx.createRadialGradient(cx, cssH / 2, 20, cx, cssH / 2, 180);
      const [gA, gB, gC] = SEVERITY_GOLD[p.severity ?? "stable"];
      haloGrad.addColorStop(0, hexA(gC, 0.16));
      haloGrad.addColorStop(0.6, hexA(gB, 0.05));
      haloGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, cssW, cssH);

      // ---- glass cylinder back wall ----
      const vialX = cx - vialW / 2;
      ctx.save();
      roundRect(ctx, vialX, vialTop, vialW, vialHeight, 18);
      const glassBg = ctx.createLinearGradient(vialX, 0, vialX + vialW, 0);
      glassBg.addColorStop(0, "rgba(20,20,28,0.92)");
      glassBg.addColorStop(0.5, "rgba(10,10,15,0.85)");
      glassBg.addColorStop(1, "rgba(20,20,28,0.92)");
      ctx.fillStyle = glassBg;
      ctx.fill();
      ctx.clip();

      // ---- liquid ----
      const levelFrac = Math.max(0.04, Math.min(1, ph.currentLevel / 100));
      const liquidTop = vialBottom - vialHeight * levelFrac;

      // Wave amplitude scales with PPG amplitude + intrinsic
      const waveAmp = 3 + p.ppgAmplitude * 7;

      // Build liquid surface path
      ctx.beginPath();
      ctx.moveTo(vialX, vialBottom);
      const slices = 36;
      for (let i = 0; i <= slices; i++) {
        const x = vialX + (i / slices) * vialW;
        const t = (i / slices) * Math.PI * 4;
        const wave1 = Math.sin(t + ph.waveOffset1) * waveAmp;
        const wave2 = Math.sin(t * 1.7 + ph.waveOffset2) * waveAmp * 0.55;
        const tilted = liquidTop + ph.sloshOffset * (i / slices - 0.5) * 2;
        ctx.lineTo(x, tilted + wave1 + wave2);
      }
      ctx.lineTo(vialX + vialW, vialBottom);
      ctx.closePath();

      // gold gradient fill
      const goldGrad = ctx.createLinearGradient(0, liquidTop, 0, vialBottom);
      goldGrad.addColorStop(0, gC);
      goldGrad.addColorStop(0.5, gB);
      goldGrad.addColorStop(1, gA);
      ctx.fillStyle = goldGrad;
      ctx.fill();

      // meniscus highlight
      ctx.beginPath();
      for (let i = 0; i <= slices; i++) {
        const x = vialX + (i / slices) * vialW;
        const t = (i / slices) * Math.PI * 4;
        const wave1 = Math.sin(t + ph.waveOffset1) * waveAmp;
        const wave2 = Math.sin(t * 1.7 + ph.waveOffset2) * waveAmp * 0.55;
        const tilted = liquidTop + ph.sloshOffset * (i / slices - 0.5) * 2;
        if (i === 0) ctx.moveTo(x, tilted + wave1 + wave2);
        else ctx.lineTo(x, tilted + wave1 + wave2);
      }
      ctx.strokeStyle = hexA(gC, 0.85);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // caustic spotlight — flashes on each detected beat
      const beatAge = p.lastBeatTs ? Date.now() - p.lastBeatTs : Infinity;
      const beatFlash = beatAge < 220 ? 1 - beatAge / 220 : 0;
      const causticAlpha = 0.12 + beatFlash * 0.35;
      const caustic = ctx.createRadialGradient(
        cx - 18, liquidTop + 10, 4,
        cx - 18, liquidTop + 10, 60,
      );
      caustic.addColorStop(0, hexA(gC, causticAlpha));
      caustic.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = caustic;
      ctx.fillRect(vialX, liquidTop - 10, vialW, 90);

      // bubbles drifting upward (intensity scales with PPG amplitude)
      const bubbleCount = 4 + Math.round(p.ppgAmplitude * 8);
      const tnow = ts / 1000;
      for (let b = 0; b < bubbleCount; b++) {
        const seed = b * 13.37;
        const bx = vialX + 14 + ((Math.sin(seed) + 1) / 2) * (vialW - 28);
        const phase = (tnow * (0.4 + (seed % 0.7)) + seed) % 1;
        const by = vialBottom - phase * (vialBottom - liquidTop - 10);
        if (by > liquidTop + 4) {
          ctx.beginPath();
          ctx.arc(bx, by, 1.4 + (seed % 1.6), 0, Math.PI * 2);
          ctx.fillStyle = hexA(gC, 0.65);
          ctx.fill();
        }
      }

      ctx.restore(); // unclip glass

      // ---- glass rim highlights ----
      roundRect(ctx, vialX, vialTop, vialW, vialHeight, 18);
      const rimGrad = ctx.createLinearGradient(vialX, 0, vialX + vialW, 0);
      rimGrad.addColorStop(0, hexA(gC, 0.85));
      rimGrad.addColorStop(0.5, hexA(gA, 0.35));
      rimGrad.addColorStop(1, hexA(gC, 0.85));
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2;
      ctx.stroke();

      // inner glass shine strip
      ctx.beginPath();
      ctx.moveTo(vialX + 12, vialTop + 14);
      ctx.lineTo(vialX + 12, vialBottom - 14);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(vialX + vialW - 16, vialTop + 24);
      ctx.lineTo(vialX + vialW - 16, vialBottom - 60);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // ---- vial cap (gold bezel) ----
      const capH = 22;
      const capW = 88;
      const capX = cx - capW / 2;
      const capY = vialTop - capH + 2;
      roundRect(ctx, capX, capY, capW, capH, 6);
      const capGrad = ctx.createLinearGradient(0, capY, 0, capY + capH);
      capGrad.addColorStop(0, gC);
      capGrad.addColorStop(0.5, gA);
      capGrad.addColorStop(1, gB);
      ctx.fillStyle = capGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // tick marks on the side
      ctx.strokeStyle = "rgba(212,175,55,0.28)";
      ctx.lineWidth = 1;
      for (let t = 0.1; t < 1; t += 0.1) {
        const y = vialBottom - vialHeight * t;
        ctx.beginPath();
        ctx.moveTo(vialX + 4, y);
        ctx.lineTo(vialX + 10, y);
        ctx.moveTo(vialX + vialW - 10, y);
        ctx.lineTo(vialX + vialW - 4, y);
        ctx.stroke();
      }

      // ---- engraving SOVEREIGN ----
      ctx.fillStyle = "rgba(212,175,55,0.5)";
      ctx.font = "9px 'Cormorant Garamond', serif";
      ctx.textAlign = "center";
      ctx.fillText("S · O · V · E · R · E · I · G · N", cx, vialBottom + 18);

      // ---- EMF lattice overlay when synthetic interference ----
      if (p.syntheticInterference) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = "rgba(255,59,59,0.18)";
        ctx.lineWidth = 0.6;
        const step = 10;
        for (let i = -cssH; i < cssW + cssH; i += step) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + cssH, cssH);
          ctx.stroke();
        }
        ctx.restore();

        // red rim flash
        roundRect(ctx, vialX - 2, vialTop - 2, vialW + 4, vialHeight + 4, 19);
        const pulse = (Math.sin(ts / 200) + 1) / 2;
        ctx.strokeStyle = `rgba(255,59,59,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const clamped = Math.max(0, Math.min(100, charge));

  return (
    <div className="bo-vial-wrap" data-testid="health-battery">
      <canvas ref={canvasRef} data-testid="health-battery-canvas" />
      {syntheticInterference && (
        <div className="bo-emf-badge floating" data-testid="emf-badge">
          <span className="dot" />
          <span className="lbl">SYNTHETIC INTERFERENCE</span>
          {typeof emfMicrotesla === "number" && (
            <span className="sub">{emfMicrotesla.toFixed(1)} µT</span>
          )}
        </div>
      )}
      <div className="bo-battery-readout">
        <span className="pct" data-testid="health-battery-pct">{Math.round(clamped)}%</span>
        <span className="bpm" data-testid="health-battery-bpm">
          {heartRate ? `${Math.round(heartRate)} BPM` : "idle pulse"}
        </span>
      </div>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexA(hex: string, a: number): string {
  // accept #rrggbb only
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default LiquidVialBattery;
