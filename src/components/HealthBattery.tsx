import React from 'react';
import { View, Text } from 'react-native';
import { Svg, Circle } from 'react-native-svg';

export const HealthBattery = ({ score = 85 }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="200" height="200">
        {/* Background Track */}
        <Circle
          cx="100" cy="100" r={radius}
          stroke="#333" strokeWidth="10" fill="transparent"
        />
        {/* Glowing Progress Bar */}
        <Circle
          cx="100" cy="100" r={radius}
          stroke="#FFD700" strokeWidth="12" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ shadowColor: '#FFD700', shadowBlur: 15 }}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Text style={{ color: '#FFD700', fontSize: 36, fontWeight: 'bold' }}>{score}%</Text>
        <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center' }}>VITALITY</Text>
      </View>
    </View>
  );
};
