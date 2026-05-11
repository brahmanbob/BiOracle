import React, { useEffect, useRef } from "react";

/**
 * Spectrogram — rolling FFT magnitude heatmap.
 *
 * Caller passes the live AnalyserNode. We pull `getByteFrequencyData`
 * on rAF and scroll the canvas left by 1px each frame, drawing the
 * latest column as a vertical gradient strip.
 *
 * Color scale: gold (top energy) → amber → magenta → deep purple.
 * Sub-50 Hz band (Lectin signature) is highlighted with a left rail.
 */
export interface SpectrogramProps {
  analyser: AnalyserNode | null;
  /** Hz cutoff for the Lectin sub-sonic band */
  lectinBandHz?: number;
  /** display max Hz */
  maxHz?: number;
}

const Spectrogram: React.FC<SpectrogramProps> = ({
  analyser,
  lectinBandHz = 50,
  maxHz = 1500,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = 320;
    const h = 120;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Start with obsidian background
    ctx.fillStyle = "#0a0a0d";
    ctx.fillRect(0, 0, w, h);

    const tick = () => {
      if (!analyser) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const bins = analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      analyser.getByteFrequencyData(data);
      const nyquist = analyser.context.sampleRate / 2;
      const binHz = nyquist / bins;
      const topBin = Math.min(bins, Math.ceil(maxHz / binHz));

      // scroll left by 1px
      const img = ctx.getImageData(1, 0, w - 1, h);
      ctx.putImageData(img, 0, 0);

      // draw newest column at right edge
      const colX = w - 1;
      for (let y = 0; y < h; y++) {
        const freqFrac = 1 - y / h; // top = high freq
        const binIdx = Math.min(topBin - 1, Math.floor(freqFrac * topBin));
        const mag = data[binIdx] / 255; // 0..1
        ctx.fillStyle = magnitudeToColor(mag);
        ctx.fillRect(colX, y, 1, 1);
      }

      // overlay sub-50Hz band marker on the right edge (recent frame)
      const lectinTopY = h - Math.min(h - 1, Math.floor((lectinBandHz / maxHz) * h));
      ctx.fillStyle = "rgba(255,90,200,0.18)";
      ctx.fillRect(colX, lectinTopY, 1, h - lectinTopY);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, lectinBandHz, maxHz]);

  return (
    <div className="bo-spectrogram-wrap" data-testid="spectrogram">
      <canvas ref={canvasRef} className="bo-spectrogram" />
      <div className="bo-spectrogram-axes">
        <span className="hz-hi">{maxHz} Hz</span>
        <span className="hz-band">{lectinBandHz} Hz · Lectin band</span>
        <span className="hz-lo">0 Hz</span>
      </div>
    </div>
  );
};

// Color ramp: deep purple → magenta → amber → gold
function magnitudeToColor(m: number): string {
  // m in 0..1; apply a small gamma for visual punch
  const g = Math.pow(m, 0.6);
  if (g < 0.001) return "#0a0a0d";
  // piecewise linear ramp through curated stops
  const stops: Array<[number, [number, number, number]]> = [
    [0.0,  [12, 6, 38]],     // deep obsidian-violet
    [0.18, [60, 16, 90]],    // dark purple
    [0.4,  [150, 32, 160]],  // magenta
    [0.65, [232, 88, 86]],   // crimson-amber
    [0.85, [248, 175, 56]],  // amber-gold
    [1.0,  [255, 230, 130]], // gold-bright
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    if (g <= t1) {
      const f = (g - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const gg = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r},${gg},${b})`;
    }
  }
  return "#ffe682";
}

export default Spectrogram;
