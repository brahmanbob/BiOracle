import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RPPGEngine, BiometricData } from './RPPGEngine';

export default function App() {
  const [hr, setHr] = useState(0);
  const [rmssd, setRmssd] = useState(0);
  const [coherence, setCoherence] = useState(0);

  useEffect(() => {
    const engine = new RPPGEngine(60);
    engine.start((data: BiometricData) => {
      setHr(Math.round(data.hr));
      setRmssd(Math.round(data.rmssd));
      setCoherence(Math.round(data.coherence * 100));
    });
    return () => engine.stop();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BiOracle V12</Text>
      <Text style={styles.value}>HR: {hr} BPM</Text>
      <Text style={styles.value}>HRV: {rmssd} ms</Text>
      <Text style={styles.value}>Coherence: {coherence}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  title: { fontSize: 28, color: '#0f0', marginBottom: 40 },
  value: { fontSize: 20, color: '#fff', marginBottom: 20 }
});
