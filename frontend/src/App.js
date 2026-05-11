import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Fingerprint,
  Activity,
  ShieldAlert,
  HeartPulse,
  Waves,
  Radio,
  Upload,
  Mic,
  Square,
  Sparkles,
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

// ============ HEALTH BATTERY ============
const HealthBattery = ({ score }) => {
  const isCritical = score < 30;
  const isWarn = score < 60 && score >= 30;
  const fillColor = isCritical
    ? 'from-[#8B0000] to-[#FF3B30]'
    : isWarn
    ? 'from-[#AA6C2C] to-[#FF8C00]'
    : 'from-[#AA8C2C] to-[#FFDF00]';
  const glow = isCritical
    ? 'shadow-[0_0_28px_#FF3B30]'
    : isWarn
    ? 'shadow-[0_0_24px_#FF8C00]'
    : 'shadow-[0_0_30px_#D4AF37]';

  return (
    <div
      className="flex flex-col items-center gap-4"
      data-testid="health-battery-container"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37]/70">
        Sovereign Charge
      </div>
      <div className="relative">
        {/* Battery cap */}
        <div className="mx-auto h-2 w-8 bg-[#D4AF37]/60 rounded-t-sm" />
        {/* Body */}
        <div
          className={`h-64 w-24 border-2 border-[#D4AF37]/50 rounded-sm relative overflow-hidden bg-black/60 ${glow} transition-all duration-700`}
          data-testid="battery-body"
        >
          {/* Filigree grid */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {[20, 40, 60, 80].map((y) => (
              <div
                key={y}
                className="absolute left-0 right-0 border-t border-[#D4AF37]/30"
                style={{ top: `${y}%` }}
              />
            ))}
          </div>
          {/* Fill */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fillColor} transition-all duration-1000 ease-in-out animate-battery-pulse`}
            style={{ height: `${score}%` }}
            data-testid="battery-fill"
          />
          {/* Score readout */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-mono text-3xl font-light text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]"
              data-testid="battery-score"
            >
              {score}
            </span>
          </div>
        </div>
      </div>
      <div className="text-xs font-mono uppercase tracking-[0.2em] text-white/60">
        {isCritical ? 'Critical Drain' : isWarn ? 'Diminished' : 'Optimal Flow'}
      </div>
    </div>
  );
};

// ============ ACOUSTIC SCANNER ============
const AcousticScanner = ({ onResult }) => {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [bars, setBars] = useState(Array(24).fill(0.1));
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const intensitySamplesRef = useRef([]);

  const stopAll = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    streamRef.current = null;
    mediaRef.current = null;
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
      alert(
        'Microphone access denied. Please allow mic to scan stomach acoustics.\n' + e.message
      );
    }
  };

  const stop = async () => {
    setRecording(false);
    const samples = intensitySamplesRef.current;
    stopAll();
    if (samples.length === 0) return;
    const intensity = samples.reduce((a, b) => a + b, 0) / samples.length;
    setAnalyzing(true);

    // Local rule preview
    const local = analyzeAcoustics(intensity);
    setResult({ intensity, ...local, interpretation: 'Consulting oracle...' });

    try {
      const r = await axios.post(`${API}/analyze-acoustic`, { intensity, interpret: true });
      setResult(r.data);
      if (onResult) onResult(r.data);
    } catch (e) {
      setResult({
        intensity,
        ...local,
        interpretation: 'Oracle unreachable. Local reading shown.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => () => stopAll(), []);

  return (
    <div
      className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      data-testid="acoustic-scanner-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <Waves className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">
          Stomach Acoustic Scanner
        </h3>
      </div>

      <div className="flex items-end gap-[3px] h-24 bg-black/60 border border-[#D4AF37]/10 px-3 py-2 mb-4">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-[#AA8C2C] to-[#FFDF00] transition-all duration-75 rounded-sm"
            style={{
              height: `${Math.max(8, b * 100)}%`,
              opacity: recording ? 1 : 0.25,
            }}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {!recording ? (
          <button
            onClick={start}
            disabled={analyzing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-[#D4AF37]/50 bg-black hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] text-[#D4AF37] font-mono uppercase tracking-widest text-xs transition-all disabled:opacity-50"
            data-testid="acoustic-start-btn"
          >
            <Mic className="w-4 h-4" /> Begin Scan
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-[#FF3B30]/60 bg-black hover:bg-[#FF3B30]/10 text-[#FF3B30] font-mono uppercase tracking-widest text-xs animate-pulse"
            data-testid="acoustic-stop-btn"
          >
            <Square className="w-4 h-4" /> End Scan
          </button>
        )}
      </div>

      {result && (
        <div className="mt-5 space-y-2" data-testid="acoustic-result">
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Intensity</div>
            <div className="text-[#D4AF37] text-right">{result.intensity.toFixed(3)}</div>
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Status</div>
            <div className="text-white text-right" data-testid="acoustic-status">
              {result.status}
            </div>
            <div className="text-[#D4AF37]/60 uppercase tracking-wider">Level</div>
            <div className="text-right">
              <span
                className={
                  result.level === 'Critical' || result.level === 'High'
                    ? 'text-[#FF3B30]'
                    : 'text-[#D4AF37]'
                }
              >
                {result.level}
              </span>
            </div>
          </div>
          {result.interpretation && (
            <div
              className="mt-3 p-3 bg-black/60 border-l-2 border-[#D4AF37] text-[11px] text-white/80 font-mono leading-relaxed"
              data-testid="acoustic-interpretation"
            >
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

// ============ FINGERPRINT ABO ============
const FingerprintABO = ({ onResult }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      setBusy(true);
      try {
        const r = await axios.post(`${API}/analyze-fingerprint`, {
          image_base64: dataUrl,
        });
        setResult(r.data);
        if (onResult) onResult(r.data);
      } catch (e) {
        const fallbackPattern = ['loop', 'whorl', 'arch'][Math.floor(Math.random() * 3)];
        setResult({
          pattern: fallbackPattern,
          blood_type: inferBloodType(fallbackPattern),
          confidence: 0.5,
          ridge_density: 0,
        });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      data-testid="fingerprint-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">
          Fingerprint → ABO
        </h3>
      </div>

      <div className="relative flex flex-col items-center justify-center min-h-[180px] bg-black/60 border border-dashed border-[#D4AF37]/30 mb-4 overflow-hidden">
        {/* Sacred geometry rings */}
        {!preview && (
          <>
            <div className="absolute w-40 h-40 rounded-full border border-[#D4AF37]/15 animate-spin-slow" />
            <div className="absolute w-28 h-28 rounded-full border border-[#D4AF37]/20" />
            <div className="absolute w-16 h-16 rounded-full border border-[#D4AF37]/25" />
          </>
        )}
        {preview ? (
          <img
            src={preview}
            alt="fingerprint"
            className="max-h-[180px] object-contain opacity-90"
            data-testid="fingerprint-preview"
          />
        ) : (
          <Fingerprint
            className="w-16 h-16 text-[#D4AF37]/70 relative"
            data-testid="fingerprint-icon"
          />
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
          <div className="text-white text-right capitalize" data-testid="fingerprint-pattern">
            {result.pattern}
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Blood Type</div>
          <div className="text-right">
            <span
              className="text-2xl font-light text-[#D4AF37] drop-shadow-[0_0_10px_#D4AF37]"
              data-testid="fingerprint-blood-type"
            >
              {result.blood_type}
            </span>
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Confidence</div>
          <div className="text-white text-right">
            {(result.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-[#D4AF37]/60 uppercase tracking-wider">Ridge Density</div>
          <div className="text-white text-right">{result.ridge_density.toFixed(4)}</div>
        </div>
      )}
    </div>
  );
};

// ============ EMERGENCY TRIAGE ============
const EmergencyTriage = ({ asymmetry, onChange }) => {
  const result = emergencyTriage(asymmetry);
  const critical = asymmetry > 0.3;
  return (
    <div
      className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm"
      data-testid="triage-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse className={`w-4 h-4 ${critical ? 'text-[#FF3B30] animate-pulse' : 'text-[#D4AF37]'}`} />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">
          Emergency Triage
        </h3>
      </div>
      <div className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60 flex justify-between">
          <span>Vascular Asymmetry</span>
          <span className="text-[#D4AF37]" data-testid="triage-asymmetry">
            {asymmetry.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={asymmetry}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-[#D4AF37]"
          data-testid="triage-slider"
        />
        <div
          className={`p-3 border-l-2 text-xs font-mono ${
            critical
              ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]'
              : 'border-[#D4AF37] bg-black/60 text-white/80'
          }`}
          data-testid="triage-status"
        >
          {result}
        </div>
      </div>
    </div>
  );
};

// ============ EMF STEALTH ============
const EMFStealth = ({ rssi, onChange }) => {
  const status = stealthMode(rssi);
  const high = rssi > -50;
  const bars = Math.max(0, Math.min(5, Math.round((rssi + 100) / 10)));
  return (
    <div
      className="bg-[#111111] border border-[#D4AF37]/20 p-5 rounded-sm"
      data-testid="emf-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <Radio className={`w-4 h-4 ${high ? 'text-[#FF8C00]' : 'text-[#D4AF37]'}`} />
        <h3 className="font-mono uppercase tracking-[0.2em] text-xs text-[#D4AF37]/80">
          EMF Stealth Mode
        </h3>
      </div>
      <div className="flex items-end gap-1 h-12 mb-3">
        {[1, 2, 3, 4, 5].map((b) => (
          <div
            key={b}
            className={`flex-1 transition-all duration-300 ${
              b <= bars
                ? high
                  ? 'bg-[#FF8C00] shadow-[0_0_8px_#FF8C00]'
                  : 'bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]'
                : 'bg-[#D4AF37]/10'
            }`}
            style={{ height: `${b * 20}%` }}
          />
        ))}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60 flex justify-between">
        <span>RSSI</span>
        <span className="text-[#D4AF37]" data-testid="emf-rssi">{rssi} dBm</span>
      </div>
      <input
        type="range"
        min="-100"
        max="-20"
        step="1"
        value={rssi}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[#D4AF37] mt-2"
        data-testid="emf-slider"
      />
      <div
        className={`mt-3 p-3 text-xs font-mono border-l-2 ${
          high
            ? 'border-[#FF8C00] bg-[#FF8C00]/10 text-[#FF8C00]'
            : 'border-[#D4AF37] bg-black/60 text-white/80'
        }`}
        data-testid="emf-status"
      >
        {status}
      </div>
    </div>
  );
};

// ============ MAIN APP ============
function App() {
  const [acousticIntensity, setAcousticIntensity] = useState(0.55);
  const [triageAsymmetry, setTriageAsymmetry] = useState(0.1);
  const [rssi, setRssi] = useState(-72);
  const [batteryScore, setBatteryScore] = useState(82);

  // Recompute battery whenever sovereign signals change
  useEffect(() => {
    const s = computeBatteryScore({
      acousticIntensity,
      triageAsymmetry,
      rssi,
    });
    setBatteryScore(s);
  }, [acousticIntensity, triageAsymmetry, rssi]);

  const handleAcousticResult = (r) => {
    setAcousticIntensity(r.intensity);
  };

  return (
    <div
      className="min-h-screen text-white relative overflow-x-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top, #1a1206 0%, #050505 60%) #050505',
      }}
      data-testid="app-root"
    >
      {/* Filigree top bar */}
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
              Sovereign Biometric Relic
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60">
            <Activity className="w-3 h-3" />
            <span data-testid="device-target">S21 // ONLINE</span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-5 py-6 space-y-5">
        {/* Battery + intro */}
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
            <HealthBattery score={batteryScore} />
            <div className="flex-1 space-y-3">
              <h2
                className="font-serif text-xl text-white leading-tight"
                style={{ fontFamily: 'Cormorant Garamond, serif' }}
              >
                The Sovereign reads the body as terrain.
              </h2>
              <p className="text-xs font-mono leading-relaxed text-white/60">
                Three relic instruments feed the central charge: enteric acoustics,
                ridge-pattern blood mapping, and vascular field integrity. Each scan
                refines the oracle.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Metric label="Acoustic" value={acousticIntensity.toFixed(2)} testid="metric-acoustic" />
                <Metric label="Asymmetry" value={triageAsymmetry.toFixed(2)} testid="metric-asymmetry" critical={triageAsymmetry > 0.3} />
                <Metric label="RSSI" value={`${rssi}`} testid="metric-rssi" critical={rssi > -50} />
              </div>
            </div>
          </div>
        </section>

        {/* Scanners */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AcousticScanner onResult={handleAcousticResult} />
          <FingerprintABO />
          <EmergencyTriage asymmetry={triageAsymmetry} onChange={setTriageAsymmetry} />
          <EMFStealth rssi={rssi} onChange={setRssi} />
        </section>

        <footer className="pt-6 pb-10 text-center text-[10px] font-mono uppercase tracking-[0.4em] text-[#D4AF37]/40">
          BiOracle V12 // For Samsung S21 // Sovereign Build
        </footer>
      </main>
    </div>
  );
}

const Metric = ({ label, value, testid, critical }) => (
  <div className="bg-black/60 border border-[#D4AF37]/15 px-3 py-2" data-testid={testid}>
    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/60">
      {label}
    </div>
    <div
      className={`font-mono text-base ${
        critical ? 'text-[#FF3B30]' : 'text-[#D4AF37]'
      }`}
    >
      {value}
    </div>
  </div>
);

export default App;
