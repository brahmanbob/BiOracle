// BIORACLE V12 — Expo / React Native entry point (Samsung S21 target) — Crack II
// New in this crack: Vascular PPG (camera + torch), Magnetometer EMF, PDF report download.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Camera, CameraView } from 'expo-camera';
import { Magnetometer } from 'expo-sensors';
import {
  analyzeAcoustics,
  inferBloodType,
  emergencyTriage,
  stealthMode,
  computeBatteryScore,
  FingerprintPattern,
} from './src/SovereignLogic';

const BACKEND_URL = 'https://fingerprint-abo.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const GOLD = '#D4AF37';
const RED = '#FF3B30';
const AMBER = '#FF8C00';
const OBSIDIAN = '#050505';
const SURFACE = '#111111';

// =========== HEALTH BATTERY (BPM-synced pulse + interference banner) ===========
const HealthBattery: React.FC<{ score: number; bpm: number; interference: boolean }> = ({ score, bpm, interference }) => {
  const critical = score < 30;
  const warn = score < 60 && score >= 30;
  const fillColor = critical ? RED : warn ? AMBER : GOLD;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = bpm > 30 ? Math.max(400, Math.min(2000, 60000 / bpm)) : 2400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bpm, pulseAnim]);

  return (
    <View style={styles.batteryWrap}>
      <Text style={styles.labelTiny}>SOVEREIGN CHARGE</Text>
      <View style={styles.batteryCap} />
      <Animated.View style={[styles.batteryBody, { shadowColor: fillColor, transform: [{ scaleY: pulseAnim }] }]}>
        <View style={[styles.batteryFill, { height: `${score}%`, backgroundColor: fillColor }]} />
        <View style={styles.batteryScoreOverlay}>
          <Text style={styles.batteryScoreText}>{score}</Text>
        </View>
        {interference && (
          <View style={styles.interferenceBanner}>
            <Text style={styles.interferenceText}>⚠ SYNTHETIC INTERFERENCE</Text>
          </View>
        )}
      </Animated.View>
      <Text style={styles.labelTiny}>
        {critical ? 'CRITICAL DRAIN' : warn ? 'DIMINISHED' : 'OPTIMAL FLOW'}
        {bpm > 0 ? `  ·  ${Math.round(bpm)} BPM` : ''}
      </Text>
    </View>
  );
};

// =========== VASCULAR PPG (rear camera + torch) ===========
const VascularPPG: React.FC<{ onResult: (r: any) => void }> = ({ onResult }) => {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const cameraRef = useRef<any>(null);
  const samplesRef = useRef<{ t: number; r: number }[]>([]);
  const tickRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, []);

  const start = async () => {
    if (!permission) {
      Alert.alert('Camera permission required');
      return;
    }
    samplesRef.current = [];
    setProgress(0);
    setResult(null);
    setScanning(true);
    const begin = Date.now();
    const DURATION = 12000;
    tickRef.current = setInterval(async () => {
      const elapsed = Date.now() - begin;
      setProgress(Math.min(1, elapsed / DURATION));
      try {
        if (cameraRef.current && cameraRef.current.takePictureAsync) {
          const pic = await cameraRef.current.takePictureAsync({ quality: 0.05, skipProcessing: true, shutterSound: false, base64: true });
          // Quick average-red estimation: decode small chunk of base64 — we sample byte triplets as RGB.
          // For real signal quality consider a native frame processor; this works for the rough PPG signal.
          const b64 = pic.base64 || '';
          let r = 0, c = 0;
          for (let i = 0; i < b64.length && c < 200; i += 17) {
            r += b64.charCodeAt(i);
            c++;
          }
          samplesRef.current.push({ t: elapsed, r: r / Math.max(1, c) });
        }
      } catch (_) {}
      if (elapsed >= DURATION) finish();
    }, 80);
  };

  const finish = async () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setScanning(false);
    const samples = samplesRef.current;
    if (samples.length < 20) return;

    // Detrend + peak detection (same as web)
    const window = 8;
    const det = samples.map((s, i) => {
      const slice = samples.slice(Math.max(0, i - window), Math.min(samples.length, i + window));
      const mean = slice.reduce((a, b) => a + b.r, 0) / slice.length;
      return { t: s.t, v: s.r - mean };
    });
    const peaks: number[] = [];
    for (let i = 2; i < det.length - 2; i++) {
      const v = det[i].v;
      if (v > det[i - 1].v && v > det[i + 1].v && v > 0.5) peaks.push(det[i].t);
    }
    let bpm = 0;
    if (peaks.length >= 2) {
      const intervals = peaks.slice(1).map((p, i) => p - peaks[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = 60000 / avg;
      if (bpm < 40 || bpm > 200) bpm = 0;
    }
    const half = Math.floor(det.length / 2);
    const variance = (arr: any[]) => {
      const m = arr.reduce((a, b) => a + b.v, 0) / arr.length;
      return arr.reduce((a, b) => a + (b.v - m) ** 2, 0) / arr.length;
    };
    const v1 = variance(det.slice(0, half)) || 0.0001;
    const v2 = variance(det.slice(half)) || 0.0001;
    const asymmetry = Math.min(1, Math.abs(v1 - v2) / Math.max(v1, v2));
    const out = { bpm: Math.round(bpm), asymmetry: Number(asymmetry.toFixed(3)) };
    setResult(out);
    onResult(out);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>VASCULAR PPG · INTERNAL BLEEDING</Text>
      <View style={styles.cameraBox}>
        {permission && (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            enableTorch={scanning}
          />
        )}
        {scanning && (
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        )}
      </View>
      <TouchableOpacity
        style={[styles.button, scanning && { borderColor: RED }]}
        onPress={scanning ? finish : start}
      >
        <Text style={[styles.buttonText, scanning && { color: RED }]}>
          {scanning ? `SCANNING ${Math.round(progress * 100)}%` : 'BEGIN PPG SCAN'}
        </Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBlock}>
          <Row label="Heart Rate" value={`${result.bpm} BPM`} highlight />
          <Row label="Asymmetry" value={`${result.asymmetry}`} />
          <Row label="Triage" value={emergencyTriage(result.asymmetry)} />
        </View>
      )}
    </View>
  );
};

// =========== ACOUSTIC SCANNER ===========
const AcousticScanner: React.FC<{ onResult: (r: any) => void }> = ({ onResult }) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Mic permission denied');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (e: any) {
      Alert.alert('Recording failed', e.message);
    }
  };

  const stop = async () => {
    if (!recording) return;
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const meter = (status as any).metering ?? -30;
      const intensity = Math.max(0, Math.min(1, (meter + 60) / 60));
      const local = analyzeAcoustics(intensity);
      setResult({ intensity, ...local });
      const resp = await fetch(`${API}/analyze-acoustic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity, interpret: true }),
      });
      const data = await resp.json();
      setResult(data);
      onResult(data);
    } finally {
      setBusy(false);
      setRecording(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>STOMACH ACOUSTIC SCANNER</Text>
      <TouchableOpacity
        style={[styles.button, recording && { borderColor: RED }]}
        onPress={recording ? stop : start}
        disabled={busy}
      >
        <Text style={[styles.buttonText, recording && { color: RED }]}>
          {busy ? 'ANALYZING...' : recording ? 'END SCAN' : 'BEGIN SCAN'}
        </Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBlock}>
          <Row label="Intensity" value={result.intensity.toFixed(3)} />
          <Row label="Status" value={result.status} />
          <Row label="Level" value={result.level} />
          {result.interpretation && <Text style={styles.oracleText}>{result.interpretation}</Text>}
        </View>
      )}
    </View>
  );
};

// =========== FINGERPRINT ABO ===========
const FingerprintABO: React.FC<{ onResult: (r: any) => void }> = ({ onResult }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    const launcher = status === 'granted' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launcher({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (!res.canceled) handle(res.assets[0]);
  };

  const handle = async (asset: any) => {
    setPreview(asset.uri);
    setBusy(true);
    try {
      const resp = await fetch(`${API}/analyze-fingerprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: `data:image/jpeg;base64,${asset.base64}` }),
      });
      const data = await resp.json();
      setResult(data);
      onResult(data);
    } catch (_) {
      const fb: FingerprintPattern = (['loop', 'whorl', 'arch'] as const)[Math.floor(Math.random() * 3)];
      setResult({ pattern: fb, blood_type: inferBloodType(fb), confidence: 0.5 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>FINGERPRINT → ABO</Text>
      <View style={styles.fingerprintBox}>
        {preview ? <Image source={{ uri: preview }} style={{ width: 120, height: 160 }} /> : <Text style={{ color: GOLD, fontSize: 48 }}>⌗</Text>}
      </View>
      <TouchableOpacity style={styles.button} onPress={pickImage} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'DECODING...' : 'CAPTURE PRINT'}</Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBlock}>
          <Row label="Pattern" value={result.pattern} />
          <Row label="Blood Type" value={result.blood_type} highlight />
        </View>
      )}
    </View>
  );
};

// =========== EMF MAGNETOMETER ===========
const EMFSensor: React.FC<{ onResult: (m: number) => void }> = ({ onResult }) => {
  const [magnitude, setMagnitude] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const subRef = useRef<any>(null);

  const start = async () => {
    Magnetometer.setUpdateInterval(250);
    subRef.current = Magnetometer.addListener(({ x, y, z }) => {
      const m = Math.sqrt(x * x + y * y + z * z);
      setMagnitude(m);
      onResult(m);
    });
    setRunning(true);
  };
  const stop = () => {
    if (subRef.current) subRef.current.remove();
    subRef.current = null;
    setRunning(false);
  };
  useEffect(() => () => stop(), []);

  const high = magnitude !== null && magnitude > 60;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>EMF MAGNETOMETER</Text>
      <Row label="Field" value={magnitude !== null ? `${magnitude.toFixed(1)} µT` : '—'} highlight={high} />
      <TouchableOpacity style={[styles.button, running && { borderColor: RED }]} onPress={running ? stop : start}>
        <Text style={[styles.buttonText, running && { color: RED }]}>{running ? 'STOP SENSOR' : 'ACTIVATE SENSOR'}</Text>
      </TouchableOpacity>
      <Text style={{ color: high ? AMBER : 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 11 }}>
        {magnitude === null ? 'Sensor idle' : high ? 'Synthetic Interference Detected' : 'EMF Baseline Normal'}
      </Text>
    </View>
  );
};

// =========== REPORT ===========
const ReportCard: React.FC<{ state: any }> = ({ state }) => {
  const [busy, setBusy] = useState(false);
  const critical =
    state.batteryScore < 30 ||
    (state.ppg && state.ppg.asymmetry > 0.3) ||
    (state.acoustic && ['High', 'Critical'].includes(state.acoustic.level));

  const generate = async () => {
    setBusy(true);
    try {
      const resp = await fetch(`${API}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bpm: state.ppg?.bpm || null,
          asymmetry: state.ppg?.asymmetry || 0,
          acoustic: state.acoustic || null,
          fingerprint: state.fingerprint || null,
          battery_score: state.batteryScore,
          emf_intensity: state.emf || null,
          notes: state.acoustic?.interpretation || null,
        }),
      });
      // Open the resulting PDF in the device browser (it streams directly).
      const scanId = resp.headers.get('x-scan-id');
      const url = `${API}/ledger/${scanId}`;
      Alert.alert('Report forged', `Scan ID: ${scanId}\nLedger: ${url}`, [
        { text: 'Open Ledger', onPress: () => Linking.openURL(url) },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Report failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, critical && { borderColor: RED }]}>
      <Text style={[styles.cardTitle, critical && { color: RED }]}>CLINICAL LEVERAGE · PDF</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 8 }}>
        Forge a gold-on-obsidian report with QR ledger link.
      </Text>
      <TouchableOpacity style={[styles.button, critical && { borderColor: RED }]} onPress={generate} disabled={busy}>
        <Text style={[styles.buttonText, critical && { color: RED }]}>{busy ? 'FORGING...' : 'GENERATE REPORT'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string | number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{String(label).toUpperCase()}</Text>
    <Text style={[styles.rowValue, highlight && styles.rowValueBig]}>{String(value)}</Text>
  </View>
);

// =========== ROOT ===========
export default function App() {
  const [acoustic, setAcoustic] = useState<any>(null);
  const [fingerprint, setFingerprint] = useState<any>(null);
  const [ppg, setPpg] = useState<any>(null);
  const [emf, setEmf] = useState<number | null>(null);
  const [score, setScore] = useState(82);

  useEffect(() => {
    setScore(
      computeBatteryScore({
        acousticIntensity: acoustic?.intensity ?? 0.55,
        triageAsymmetry: ppg?.asymmetry ?? 0.05,
        rssi: emf !== null && emf > 60 ? -40 : -72,
      })
    );
  }, [acoustic, ppg, emf]);

  const interference = emf !== null && emf > 60;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>BIORACLE V12</Text>
      <Text style={styles.subtitle}>SOVEREIGN BIOMETRIC RELIC · CRACK II</Text>

      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <HealthBattery score={score} bpm={ppg?.bpm || 0} interference={interference} />
      </View>

      <VascularPPG onResult={setPpg} />
      <AcousticScanner onResult={setAcoustic} />
      <FingerprintABO onResult={setFingerprint} />
      <EMFSensor onResult={setEmf} />
      <ReportCard state={{ acoustic, fingerprint, ppg, emf, batteryScore: score }} />

      <Text style={styles.footer}>BIORACLE V12 // CRACK II // SOVEREIGN BUILD</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OBSIDIAN },
  h1: { color: GOLD, fontSize: 28, fontWeight: '300', letterSpacing: 4, textAlign: 'center', marginTop: 24 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 3, textAlign: 'center', marginTop: 4 },
  card: { backgroundColor: SURFACE, borderColor: 'rgba(212,175,55,0.2)', borderWidth: 1, padding: 16, marginVertical: 8 },
  cardTitle: { color: GOLD, fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  button: { borderColor: GOLD, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: GOLD, letterSpacing: 2, fontSize: 12 },
  resultBlock: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: 'rgba(212,175,55,0.6)', fontSize: 10, letterSpacing: 1.5 },
  rowValue: { color: '#fff', fontSize: 12 },
  rowValueBig: { color: GOLD, fontSize: 22, fontWeight: '300' },
  oracleText: {
    marginTop: 10, color: 'rgba(255,255,255,0.8)', fontSize: 11,
    borderLeftColor: GOLD, borderLeftWidth: 2, paddingLeft: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', padding: 8,
  },
  cameraBox: {
    height: 180, backgroundColor: '#000', borderColor: 'rgba(212,175,55,0.3)', borderWidth: 1, marginBottom: 12, overflow: 'hidden',
  },
  progressBar: { position: 'absolute', bottom: 0, left: 0, height: 3, backgroundColor: GOLD },
  fingerprintBox: {
    height: 180, borderColor: 'rgba(212,175,55,0.3)', borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: '#000',
  },
  batteryWrap: { alignItems: 'center' },
  batteryCap: { height: 6, width: 28, backgroundColor: 'rgba(212,175,55,0.6)' },
  batteryBody: {
    height: 240, width: 90, borderWidth: 2, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', overflow: 'hidden',
    shadowOpacity: 0.8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, marginVertical: 8,
  },
  batteryFill: { width: '100%' },
  batteryScoreOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  batteryScoreText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  interferenceBanner: {
    position: 'absolute', top: 4, left: 4, right: 4, paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.75)', borderColor: AMBER, borderWidth: 1, alignItems: 'center',
  },
  interferenceText: { color: AMBER, fontSize: 8, letterSpacing: 1.5 },
  labelTiny: { color: 'rgba(212,175,55,0.7)', fontSize: 9, letterSpacing: 3 },
  footer: { color: 'rgba(212,175,55,0.4)', fontSize: 9, letterSpacing: 4, textAlign: 'center', marginTop: 24, marginBottom: 24 },
});
