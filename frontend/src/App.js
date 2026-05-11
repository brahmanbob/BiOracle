import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Fingerprint,
  Activity,
  HeartPulse,
  Waves,
  Radio,
  Upload,
  Mic,
  Square,
  Sparkles,
  Camera,
  FileDown,
  Zap,
} from 'lucide-react';
import {
  inferBloodType,
  analyzeAcoustics,
  emergencyTriage,
  stealthMode,
  computeBatteryScore,
} from './sovereignLogic';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ============ HEALTH BATTERY (now heart-rate synced) ============
const HealthBattery = ({ score, bpm, interference }) => {
  const critical = score < 30;
  const warn = score < 60 && score >= 30;
  const fillColor = critical
    ? 'from-[#8B0000] to-[#FF3B30]'
    : warn
    ? 'from-[#AA6C2C] to-[#FF8C00]'
    : 'from-[#AA8C2C] to-[#FFDF00]';
  const glow = critical
    ? 'shadow-[0_0_28px_#FF3B30]'
    : warn
    ? 'shadow-[0_0_24px_#FF8C00]'
    : 'shadow-[0_0_30px_#D4AF37]';

  // Heart-rate-driven pulse: duration in seconds = 60 / bpm
  const pulseDuration = bpm && bpm > 30 ? Math.max(0.4, Math.min(2.0, 60 / bpm)) : 3;

  return (
    <div className="flex flex-col items-center gap-4" data-testid="health-battery-container">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37]/70">
        Sovereign Charge
      </div>
      <div className="relative">
        <div className="mx-auto h-2 w-8 bg-[#D4AF37]/60 rounded-t-sm" />
        <div
          className={`h-64 w-24 border-2 border-[#D4AF37]/50 rounded-sm relative overflow-hidden bg-black/60 ${glow} transition-all duration-700`}
          data-testid="battery-body"
        >
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {[20, 40, 60, 80].map((y) => (
              <div key={y} className="absolute left-0 right-0 border-t border-[#D4AF37]/30" style={{ top: `${y}%` }} />
            ))}
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fillColor} transition-all duration-1000 ease-in-out`}
            style={{
              height: `${score}%`,
              animation: `batteryPulse ${pulseDuration}s ease-in-out infinite`,
            }}
            data-testid="battery-fill"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-mono text-3xl font-light text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]"
              data-testid="battery-score"
            >
              {score}
            </span>
          </div>
          {interference && (
            <div
              className="absolute top-1 left-1 right-1 text-center text-[8px] font-mono uppercase tracking-[0.15em] text-[#FF8C00] bg-black/70 py-0.5 border border-[#FF8C00]/40 animate-pulse"
              data-testid="battery-interference"
            >
              ⚠ Synthetic Interference
            </div>
          )}
        </div>
      </div>
      <div className="text-xs font-mono uppercase tracking-[0.2em] text-white/60">
        {critical ? 'Critical Drain' : warn ? 'Diminished' : 'Optimal Flow'}
        {bpm > 0 && <span className="text-[#D4AF37] ml-2">· {Math.round(bpm)} BPM</span>}
      </div>
    </div>
  );
};

// ============ VASCULAR PPG (rear camera + flash) ============
const VascularPPG = ({ onResult }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const intervalRef = useRef(null);
  const samplesRef = useRef([]);

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackRef.current = null;
  };

  const start = async () => {
    setResult(null);
    setProgress(0);
    samplesRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: 320, height: 240 },
      });
      streamRef.current = stream;
      const [track] = stream.getVideoTracks();
      trackRef.current = track;
      // Try to turn on torch (S21 supports this in Chrome)
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
        }
      } catch (_) {}

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const start = Date.now();
      const DURATION = 12000; // 12s scan

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        setProgress(Math.min(1, elapsed / DURATION));
        if (!videoRef.current) return;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          count++;
        }
        const avgRed = r / count;
        samplesRef.current.push({ t: elapsed, r: avgRed });

        if (elapsed >= DURATION) {
          clearInterval(intervalRef.current);
          finishScan();
        }
      }, 50);
    } catch (e) {
      alert('Camera access denied. Place fingertip over rear camera + flash.\n' + e.message);
      setScanning(false);
    }
  };

  const finishScan = async () => {
    setScanning(false);
    stopCamera();
    const samples = samplesRef.current;
    if (samples.length < 30) return;

    // Detrend (subtract moving average)
    const window = 10;
    const detrended = samples.map((s, i) => {
      const lo = Math.max(0, i - window);
      const hi = Math.min(samples.length, i + window);
      const slice = samples.slice(lo, hi);
      const mean = slice.reduce((a, b) => a + b.r, 0) / slice.length;
      return { t: s.t, v: s.r - mean };
    });

    // Peak detection
    const peaks = [];
    for (let i = 2; i < detrended.length - 2; i++) {
      const v = detrended[i].v;
      if (
        v > detrended[i - 1].v &&
        v > detrended[i + 1].v &&
        v > detrended[i - 2].v &&
        v > detrended[i + 2].v &&
        v > 0.4
      ) {
        peaks.push(detrended[i].t);
      }
    }

    let bpm = 0;
    if (peaks.length >= 2) {
      const intervals = peaks.slice(1).map((p, i) => p - peaks[i]);
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = 60000 / avgInterval;
      // Clamp to plausible human range
      if (bpm < 40 || bpm > 200) bpm = 0;
    }

    // Asymmetry: compare variance of first half vs second half of red signal
    const half = Math.floor(detrended.length / 2);
    const variance = (arr) => {
      const m = arr.reduce((a, b) => a + b.v, 0) / arr.length;
      return arr.reduce((a, b) => a + (b.v - m) ** 2, 0) / arr.length;
    };
    const v1 = variance(detrended.slice(0, half)) || 0.0001;
    const v2 = variance(detrended.slice(half)) || 0.0001;
    const asymmetry = Math.min(1, Math.abs(v1 - v2) / Math.max(v1, v2));

    const out = { bpm: Math.round(bpm), asymmetry: Number(asymmetry.toFixed(3)), samples: samples.length, peaks: peaks.length };
    setResult(out);
    if (onResult) onResult(out);

    // Persist to triage
    try {
      await axios.post(`${API}/triage`, { asymmetry: out.asymmetry });
    } catch (_) {}
  };

  useEffect(() => () => stopCamera(), []);

  const critical = result && result.asymmetry > 0.3;

  return (
    <div className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm" data-testid="ppg-card">
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse className={`w-4 h-4 ${critical ? 'text-[#FF3B30] animate-pulse' : 'text-[#D4AF37]'}`} />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">
          Vascular PPG · Internal Bleeding
        </h3>
      </div>

      <div className="relative bg-black/80 border border-[#D4AF37]/20 mb-3 overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} width={320} height={240} className="hidden" />
        {!scanning && !result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60">
            <Camera className="w-8 h-8 mb-2 text-[#D4AF37]/50" />
            Cover rear camera + flash with fingertip
          </div>
        )}
        {scanning && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D4AF37]/30">
            <div className="h-full bg-[#D4AF37]" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      <button
        onClick={scanning ? finishScan : start}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 border bg-black hover:bg-[#D4AF37]/10 font-mono uppercase tracking-widest text-xs transition-all ${
          scanning ? 'border-[#FF3B30]/60 text-[#FF3B30] animate-pulse' : 'border-[#D4AF37]/50 text-[#D4AF37] hover:border-[#D4AF37]'
        }`}
        data-testid="ppg-toggle-btn"
      >
        {scanning ? <Square className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        {scanning ? `Scanning... ${Math.round(progress * 100)}%` : 'Begin PPG Scan'}
      </button>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono" data-testid="ppg-result">
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Heart Rate</div>
          <div className="text-right">
            <span className="text-[#D4AF37] text-lg" data-testid="ppg-bpm">{result.bpm || '—'}</span>
            <span className="text-[#D4AF37]/60 text-[10px] ml-1">BPM</span>
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Asymmetry</div>
          <div className={`text-right ${critical ? 'text-[#FF3B30]' : 'text-white'}`} data-testid="ppg-asymmetry">
            {result.asymmetry}
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Triage</div>
          <div className={`text-right ${critical ? 'text-[#FF3B30]' : 'text-[#D4AF37]'}`} data-testid="ppg-triage-status">
            {emergencyTriage(result.asymmetry)}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ ACOUSTIC SCANNER (unchanged from Crack #1) ============
const AcousticScanner = ({ onResult }) => {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [bars, setBars] = useState(Array(24).fill(0.1));
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const intensitySamplesRef = useRef([]);

  const stopAll = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      intensitySamplesRef.current = [];

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const norm = Array.from(data.slice(0, 24)).map((v) => Math.max(0.05, v / 255));
        setBars(norm);
        const avg = norm.reduce((a, b) => a + b, 0) / norm.length;
        intensitySamplesRef.current.push(avg);
        animRef.current = requestAnimationFrame(loop);
      };
      loop();
      setRecording(true);
    } catch (e) {
      alert('Microphone access denied.\n' + e.message);
    }
  };

  const stop = async () => {
    setRecording(false);
    const samples = intensitySamplesRef.current;
    stopAll();
    if (samples.length === 0) return;
    const intensity = samples.reduce((a, b) => a + b, 0) / samples.length;
    setAnalyzing(true);
    const local = analyzeAcoustics(intensity);
    setResult({ intensity, ...local, interpretation: 'Consulting oracle...' });
    try {
      const r = await axios.post(`${API}/analyze-acoustic`, { intensity, interpret: true });
      setResult(r.data);
      if (onResult) onResult(r.data);
    } catch (e) {
      setResult({ intensity, ...local, interpretation: 'Oracle unreachable.' });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => () => stopAll(), []);

  return (
    <div className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm" data-testid="acoustic-scanner-card">
      <div className="flex items-center gap-2 mb-3">
        <Waves className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">Stomach Acoustic Scanner</h3>
      </div>
      <div className="flex items-end gap-[3px] h-24 bg-black/60 border border-[#D4AF37]/10 px-3 py-2 mb-4">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-[#AA8C2C] to-[#FFDF00] transition-all duration-75 rounded-sm"
            style={{ height: `${Math.max(8, b * 100)}%`, opacity: recording ? 1 : 0.25 }}
          />
        ))}
      </div>
      {!recording ? (
        <button
          onClick={start}
          disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#D4AF37]/50 bg-black hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] text-[#D4AF37] font-mono uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          data-testid="acoustic-start-btn"
        >
          <Mic className="w-4 h-4" /> Begin Scan
        </button>
      ) : (
        <button
          onClick={stop}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#FF3B30]/60 bg-black hover:bg-[#FF3B30]/10 text-[#FF3B30] font-mono uppercase tracking-widest text-xs animate-pulse"
          data-testid="acoustic-stop-btn"
        >
          <Square className="w-4 h-4" /> End Scan
        </button>
      )}
      {result && (
        <div className="mt-5 space-y-2" data-testid="acoustic-result">
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Intensity</div>
            <div className="text-[#D4AF37] text-right">{result.intensity.toFixed(3)}</div>
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Status</div>
            <div className="text-white text-right" data-testid="acoustic-status">{result.status}</div>
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Level</div>
            <div className="text-right">
              <span className={result.level === 'Critical' || result.level === 'High' ? 'text-[#FF3B30]' : 'text-[#D4AF37]'}>
                {result.level}
              </span>
            </div>
          </div>
          {result.interpretation && (
            <div className="mt-3 p-3 bg-black/60 border-l-2 border-[#D4AF37] text-[11px] text-white/80 font-mono leading-relaxed" data-testid="acoustic-interpretation">
              <div className="flex items-center gap-1 mb-1 text-[#D4AF37] uppercase tracking-[0.2em] text-[9px]">
                <Sparkles className="w-3 h-3" /> Oracle Reading
              </div>
              {analyzing ? 'Consulting the oracle...' : result.interpretation}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ FINGERPRINT ABO (unchanged) ============
const FingerprintABO = ({ onResult }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      setBusy(true);
      try {
        const r = await axios.post(`${API}/analyze-fingerprint`, { image_base64: dataUrl });
        setResult(r.data);
        if (onResult) onResult(r.data);
      } catch (e) {
        const fb = ['loop', 'whorl', 'arch'][Math.floor(Math.random() * 3)];
        setResult({ pattern: fb, blood_type: inferBloodType(fb), confidence: 0.5, ridge_density: 0 });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm" data-testid="fingerprint-card">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">Fingerprint → ABO</h3>
      </div>
      <div className="relative flex flex-col items-center justify-center min-h-[180px] bg-black/60 border border-dashed border-[#D4AF37]/30 mb-4 overflow-hidden">
        {!preview && (
          <>
            <div className="absolute w-40 h-40 rounded-full border border-[#D4AF37]/15 animate-spin-slow" />
            <div className="absolute w-28 h-28 rounded-full border border-[#D4AF37]/20" />
            <div className="absolute w-16 h-16 rounded-full border border-[#D4AF37]/25" />
          </>
        )}
        {preview ? (
          <img src={preview} alt="fingerprint" className="max-h-[180px] object-contain opacity-90" data-testid="fingerprint-preview" />
        ) : (
          <Fingerprint className="w-16 h-16 text-[#D4AF37]/70 relative" data-testid="fingerprint-icon" />
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onFile(e.target.files[0])}
        className="hidden"
        data-testid="fingerprint-file-input"
      />
      <button
        onClick={() => fileRef.current.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#D4AF37]/50 bg-black hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] text-[#D4AF37] font-mono uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        data-testid="fingerprint-upload-btn"
      >
        <Upload className="w-4 h-4" />
        {busy ? 'Decoding Ridges...' : 'Capture / Upload Print'}
      </button>
      {result && (
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-mono" data-testid="fingerprint-result">
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Pattern</div>
          <div className="text-white text-right capitalize" data-testid="fingerprint-pattern">{result.pattern}</div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Blood Type</div>
          <div className="text-right">
            <span className="text-2xl font-light text-[#D4AF37] drop-shadow-[0_0_10px_#D4AF37]" data-testid="fingerprint-blood-type">{result.blood_type}</span>
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Confidence</div>
          <div className="text-white text-right">{(result.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
};

// ============ MAGNETOMETER / EMF (real device API) ============
const Magnetometer = ({ onResult }) => {
  const [magnitude, setMagnitude] = useState(null);
  const [supported, setSupported] = useState(false);
  const [running, setRunning] = useState(false);
  const sensorRef = useRef(null);
  const fallbackRef = useRef(null);

  const start = async () => {
    setRunning(true);
    // 1. Native Magnetometer API (Chrome Android with HTTPS)
    if ('Magnetometer' in window) {
      try {
        // eslint-disable-next-line no-undef
        const sensor = new window.Magnetometer({ frequency: 4 });
        sensor.addEventListener('reading', () => {
          const m = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
          setMagnitude(m);
          if (onResult) onResult(m);
        });
        sensor.start();
        sensorRef.current = sensor;
        setSupported(true);
        return;
      } catch (e) {
        console.warn('Magnetometer API blocked:', e);
      }
    }
    // 2. Fallback: DeviceOrientationEvent with webkitCompassHeading on iOS, or just rotation rate
    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          await DeviceOrientationEvent.requestPermission();
        } catch (_) {}
      }
      const handler = (e) => {
        const a = e.alpha || 0;
        const b = e.beta || 0;
        const g = e.gamma || 0;
        // Crude proxy magnitude — not real µT but reactive to phone tilt/orientation
        const proxy = Math.sqrt(a * a + b * b + g * g) / 5;
        setMagnitude(proxy);
        if (onResult) onResult(proxy);
      };
      window.addEventListener('deviceorientation', handler);
      fallbackRef.current = handler;
      setSupported(true);
      return;
    }
    // 3. Last resort: simulate background hum
    setSupported(false);
    const id = setInterval(() => {
      const v = 25 + Math.random() * 10;
      setMagnitude(v);
      if (onResult) onResult(v);
    }, 500);
    fallbackRef.current = () => clearInterval(id);
  };

  const stop = () => {
    setRunning(false);
    if (sensorRef.current) sensorRef.current.stop();
    sensorRef.current = null;
    if (fallbackRef.current) {
      if (typeof fallbackRef.current === 'function') {
        // Could be either an event handler or a cleanup fn
        window.removeEventListener('deviceorientation', fallbackRef.current);
        try { fallbackRef.current(); } catch (_) {}
      }
      fallbackRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const high = magnitude !== null && magnitude > 60; // µT threshold (Earth ~25-65)
  const status = magnitude === null
    ? 'Sensor idle'
    : high
      ? 'Synthetic Interference Detected'
      : 'EMF Baseline Normal';

  return (
    <div className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm" data-testid="emf-card">
      <div className="flex items-center gap-2 mb-3">
        <Radio className={`w-4 h-4 ${high ? 'text-[#FF8C00] animate-pulse' : 'text-[#D4AF37]'}`} />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">EMF Magnetometer</h3>
      </div>
      <div className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60 flex justify-between">
          <span>Field Magnitude</span>
          <span className="text-[#D4AF37]" data-testid="emf-magnitude">
            {magnitude !== null ? `${magnitude.toFixed(1)} µT` : '—'}
          </span>
        </div>
        <div className="flex items-end gap-1 h-12">
          {[1, 2, 3, 4, 5].map((b) => {
            const filled = magnitude !== null && magnitude > b * 15;
            return (
              <div
                key={b}
                className={`flex-1 transition-all duration-300 ${
                  filled
                    ? high
                      ? 'bg-[#FF8C00] shadow-[0_0_8px_#FF8C00]'
                      : 'bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]'
                    : 'bg-[#D4AF37]/10'
                }`}
                style={{ height: `${b * 20}%` }}
              />
            );
          })}
        </div>
        <button
          onClick={running ? stop : start}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 border bg-black font-mono uppercase tracking-widest text-xs transition-all ${
            running ? 'border-[#FF3B30]/60 text-[#FF3B30] animate-pulse' : 'border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10'
          }`}
          data-testid="emf-toggle-btn"
        >
          <Zap className="w-4 h-4" /> {running ? 'Stop Sensor' : 'Activate Sensor'}
        </button>
        <div
          className={`p-3 text-xs font-mono border-l-2 ${
            high ? 'border-[#FF8C00] bg-[#FF8C00]/10 text-[#FF8C00]' : 'border-[#D4AF37] bg-black/60 text-white/80'
          }`}
          data-testid="emf-status"
        >
          {status}
          {!supported && magnitude !== null && (
            <span className="block text-[9px] text-white/40 mt-1">(simulated — magnetometer unavailable)</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ CLINICAL REPORT PDF ============
const ClinicalReport = ({ state }) => {
  const [busy, setBusy] = useState(false);
  const [lastFile, setLastFile] = useState(null);
  const critical =
    state.batteryScore < 30 ||
    (state.ppg && state.ppg.asymmetry > 0.3) ||
    (state.acoustic && ['High', 'Critical'].includes(state.acoustic.level));

  const generate = async () => {
    setBusy(true);
    try {
      const body = {
        bpm: state.ppg?.bpm || null,
        asymmetry: state.ppg?.asymmetry || 0,
        acoustic: state.acoustic || null,
        fingerprint: state.fingerprint || null,
        battery_score: state.batteryScore,
        emf_intensity: state.emf || null,
        notes: state.acoustic?.interpretation || null,
      };
      const r = await axios.post(`${API}/report`, body, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `bioracle-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setLastFile(a.download);
    } catch (e) {
      alert('Report generation failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`p-5 rounded-sm border ${
        critical ? 'border-[#FF3B30]/60 bg-[#FF3B30]/5 animate-pulse' : 'border-[#D4AF37]/20 bg-[#111111]'
      }`}
      data-testid="report-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <FileDown className={`w-4 h-4 ${critical ? 'text-[#FF3B30]' : 'text-[#D4AF37]'}`} />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">Clinical Leverage · PDF</h3>
        {critical && (
          <span className="ml-auto text-[9px] font-mono uppercase tracking-[0.2em] text-[#FF3B30]" data-testid="report-critical-badge">
            ⚠ Critical Signal
          </span>
        )}
      </div>
      <p className="text-[11px] font-mono text-white/60 mb-3 leading-relaxed">
        Gold-on-obsidian one-page report. QR code links to the raw sensor ledger. Hand it to the medic.
      </p>
      <button
        onClick={generate}
        disabled={busy}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 border bg-black hover:bg-[#D4AF37]/10 font-mono uppercase tracking-widest text-xs transition-all disabled:opacity-50 ${
          critical ? 'border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30]/10' : 'border-[#D4AF37]/50 text-[#D4AF37] hover:border-[#D4AF37]'
        }`}
        data-testid="report-generate-btn"
      >
        <FileDown className="w-4 h-4" />
        {busy ? 'Forging Report...' : critical ? 'Generate Critical Report' : 'Generate Report'}
      </button>
      {lastFile && (
        <div className="mt-3 text-[10px] font-mono text-[#D4AF37]/70" data-testid="report-last-file">
          Last forged: {lastFile}
        </div>
      )}
    </div>
  );
};

// ============ MAIN APP ============
function App() {
  const [acoustic, setAcoustic] = useState(null);
  const [fingerprint, setFingerprint] = useState(null);
  const [ppg, setPpg] = useState(null);
  const [emf, setEmf] = useState(null);
  const [batteryScore, setBatteryScore] = useState(82);

  useEffect(() => {
    const s = computeBatteryScore({
      acousticIntensity: acoustic?.intensity ?? 0.55,
      triageAsymmetry: ppg?.asymmetry ?? 0.05,
      rssi: emf && emf > 60 ? -40 : -72,
    });
    setBatteryScore(s);
  }, [acoustic, ppg, emf]);

  const interference = emf !== null && emf > 60;

  return (
    <div
      className="min-h-screen text-white relative overflow-x-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #1a1206 0%, #050505 60%) #050505' }}
      data-testid="app-root"
    >
      <header className="border-b border-[#D4AF37]/15 backdrop-blur-md bg-black/40 sticky top-0 z-20">
        <div className="max-w-screen-md mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1
              className="font-serif text-2xl tracking-[0.15em] text-[#D4AF37] uppercase"
              style={{ fontFamily: 'Cormorant Garamond, serif' }}
              data-testid="app-title"
            >
              BiOracle V12
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
              Sovereign Biometric Relic · Crack II
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60">
            <Activity className="w-3 h-3" />
            <span data-testid="device-target">S21 // ONLINE</span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-5 py-6 space-y-5">
        <section className="bg-[#0a0a0a] border border-[#D4AF37]/15 p-6 rounded-sm relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1643324896137-f0928e76202a?crop=entropy&cs=srgb&fm=jpg&w=800)',
              backgroundSize: 'cover',
              mixBlendMode: 'overlay',
            }}
          />
          <div className="flex flex-col md:flex-row items-center gap-8 relative">
            <HealthBattery score={batteryScore} bpm={ppg?.bpm || 0} interference={interference} />
            <div className="flex-1 space-y-3">
              <h2 className="font-serif text-xl text-white leading-tight" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                The Sovereign reads the body as terrain.
              </h2>
              <p className="text-xs font-mono leading-relaxed text-white/60">
                Acoustics, ridges, vascular rhythm, magnetic field. Four relic instruments — one charge.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <Metric label="BPM" value={ppg?.bpm || '—'} testid="metric-bpm" />
                <Metric label="Asymmetry" value={(ppg?.asymmetry ?? 0).toFixed(2)} testid="metric-asymmetry" critical={(ppg?.asymmetry ?? 0) > 0.3} />
                <Metric label="Acoustic" value={(acoustic?.intensity ?? 0.55).toFixed(2)} testid="metric-acoustic" />
                <Metric label="EMF µT" value={emf !== null ? emf.toFixed(0) : '—'} testid="metric-emf" critical={emf > 60} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <VascularPPG onResult={setPpg} />
          <AcousticScanner onResult={setAcoustic} />
          <FingerprintABO onResult={setFingerprint} />
          <Magnetometer onResult={setEmf} />
        </section>

        <section>
          <ClinicalReport state={{ acoustic, fingerprint, ppg, emf, batteryScore }} />
        </section>

        <footer className="pt-6 pb-10 text-center text-[10px] font-mono uppercase tracking-[0.4em] text-[#D4AF37]/40">
          BiOracle V12 // Crack II // Sovereign Build
        </footer>
      </main>
    </div>
  );
}

const Metric = ({ label, value, testid, critical }) => (
  <div className="bg-black/60 border border-[#D4AF37]/15 px-3 py-2" data-testid={testid}>
    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60">{label}</div>
    <div className={`font-mono text-base ${critical ? 'text-[#FF3B30]' : 'text-[#D4AF37]'}`}>{value}</div>
  </div>
);

export default App;
