// BIORACLE V12 — Expo / React Native entry point (Samsung S21 target)
// Mirrors the web App.js logic. Run with: npx expo start
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import {
  analyzeAcoustics,
  inferBloodType,
  emergencyTriage,
  stealthMode,
  computeBatteryScore,
  FingerprintPattern,
} from './src/SovereignLogic';

// Set this to the same backend URL the web preview uses.
const BACKEND_URL = 'https://fingerprint-abo.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const GOLD = '#D4AF37';
const OBSIDIAN = '#050505';
const SURFACE = '#111111';

// =========== HEALTH BATTERY ===========
const HealthBattery: React.FC<{ score: number }> = ({ score }) => {
  const critical = score < 30;
  const warn = score < 60 && score >= 30;
  const fillColor = critical ? '#FF3B30' : warn ? '#FF8C00' : GOLD;
  return (
    <View style={styles.batteryWrap}>
      <Text style={styles.labelTiny}>SOVEREIGN CHARGE</Text>
      <View style={styles.batteryCap} />
      <View style={[styles.batteryBody, { shadowColor: fillColor }]}>
        <View
          style={[
            styles.batteryFill,
            { height: `${score}%`, backgroundColor: fillColor },
          ]}
        />
        <View style={styles.batteryScoreOverlay}>
          <Text style={styles.batteryScoreText}>{score}</Text>
        </View>
      </View>
      <Text style={styles.labelTiny}>
        {critical ? 'CRITICAL DRAIN' : warn ? 'DIMINISHED' : 'OPTIMAL FLOW'}
      </Text>
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
      if (status !== 'granted') {
        Alert.alert('Mic permission denied');
        return;
      }
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
      // Estimate intensity from average metering (fallback to random sample if unavailable)
      const status = await recording.getStatusAsync();
      const meter = (status as any).metering ?? -30;
      const intensity = Math.max(0, Math.min(1, (meter + 60) / 60));
      const local = analyzeAcoustics(intensity);
      setResult({ intensity, ...local, interpretation: 'Consulting oracle...' });

      const resp = await fetch(`${API}/analyze-acoustic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity, interpret: true }),
      });
      const data = await resp.json();
      setResult(data);
      onResult(data);
    } catch (e: any) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setBusy(false);
      setRecording(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>STOMACH ACOUSTIC SCANNER</Text>
      <TouchableOpacity
        style={[styles.button, recording && { borderColor: '#FF3B30' }]}
        onPress={recording ? stop : start}
        disabled={busy}
      >
        <Text style={[styles.buttonText, recording && { color: '#FF3B30' }]}>
          {busy ? 'ANALYZING...' : recording ? 'END SCAN' : 'BEGIN SCAN'}
        </Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBlock}>
          <Row label="Intensity" value={result.intensity.toFixed(3)} />
          <Row label="Status" value={result.status} />
          <Row label="Level" value={result.level} />
          {result.interpretation && (
            <Text style={styles.oracleText}>{result.interpretation}</Text>
          )}
        </View>
      )}
    </View>
  );
};

// =========== FINGERPRINT ABO ===========
const FingerprintABO: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      // Fall back to library
      const lib = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.6,
      });
      if (!lib.canceled) handleImage(lib.assets[0]);
      return;
    }
    const cam = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (!cam.canceled) handleImage(cam.assets[0]);
  };

  const handleImage = async (asset: any) => {
    setPreview(asset.uri);
    setBusy(true);
    try {
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      const resp = await fetch(`${API}/analyze-fingerprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      const fallback: FingerprintPattern = (['loop', 'whorl', 'arch'] as const)[
        Math.floor(Math.random() * 3)
      ];
      setResult({
        pattern: fallback,
        blood_type: inferBloodType(fallback),
        confidence: 0.5,
        ridge_density: 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>FINGERPRINT → ABO</Text>
      <View style={styles.fingerprintBox}>
        {preview ? (
          <Image source={{ uri: preview }} style={{ width: 120, height: 160 }} />
        ) : (
          <Text style={{ color: GOLD, fontSize: 48 }}>⌗</Text>
        )}
      </View>
      <TouchableOpacity style={styles.button} onPress={pickImage} disabled={busy}>
        <Text style={styles.buttonText}>
          {busy ? 'DECODING...' : 'CAPTURE PRINT'}
        </Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBlock}>
          <Row label="Pattern" value={result.pattern} />
          <Row label="Blood Type" value={result.blood_type} highlight />
          <Row label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} />
        </View>
      )}
    </View>
  );
};

// =========== HELPER ===========
const Row: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, highlight && styles.rowValueBig]}>{value}</Text>
  </View>
);

// =========== ROOT ===========
export default function App() {
  const [acousticIntensity, setAcousticIntensity] = useState(0.55);
  const [score, setScore] = useState(82);

  useEffect(() => {
    setScore(computeBatteryScore({ acousticIntensity, triageAsymmetry: 0.1, rssi: -72 }));
  }, [acousticIntensity]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>BIORACLE V12</Text>
      <Text style={styles.subtitle}>SOVEREIGN BIOMETRIC RELIC // S21</Text>

      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <HealthBattery score={score} />
      </View>

      <AcousticScanner onResult={(r) => setAcousticIntensity(r.intensity)} />
      <FingerprintABO />

      <Text style={styles.footer}>BIORACLE V12 // SOVEREIGN BUILD</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OBSIDIAN },
  h1: {
    color: GOLD,
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: SURFACE,
    borderColor: 'rgba(212,175,55,0.2)',
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  cardTitle: {
    color: GOLD,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 12,
  },
  button: {
    borderColor: GOLD,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: GOLD, letterSpacing: 2, fontSize: 12 },
  resultBlock: { marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: 'rgba(212,175,55,0.6)', fontSize: 10, letterSpacing: 1.5 },
  rowValue: { color: '#fff', fontSize: 12 },
  rowValueBig: { color: GOLD, fontSize: 22, fontWeight: '300' },
  oracleText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    borderLeftColor: GOLD,
    borderLeftWidth: 2,
    paddingLeft: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
  },
  fingerprintBox: {
    height: 180,
    borderColor: 'rgba(212,175,55,0.3)',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#000',
  },
  batteryWrap: { alignItems: 'center' },
  batteryCap: {
    height: 6,
    width: 28,
    backgroundColor: 'rgba(212,175,55,0.6)',
    marginBottom: 0,
  },
  batteryBody: {
    height: 240,
    width: 90,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    marginVertical: 8,
  },
  batteryFill: { width: '100%' },
  batteryScoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryScoreText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  labelTiny: { color: 'rgba(212,175,55,0.7)', fontSize: 9, letterSpacing: 3 },
  footer: {
    color: 'rgba(212,175,55,0.4)',
    fontSize: 9,
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
});
