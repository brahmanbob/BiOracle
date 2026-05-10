// BiOracle V12 - Sovereign Dashboard (The Mirror)
import React from 'react';

export const HealthBattery = ({ level }: { level: number }) => {
  const glowColor = level > 50 ? '#FFD700' : '#FF4500'; // Gold or Red Alert
  return (
    <div style={{
      width: '200px', height: '200px', borderRadius: '50%',
      border: `8px solid ${glowColor}`, 
      boxShadow: `0 0 20px ${glowColor}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <span style={{ fontSize: '2rem', color: 'white' }}>{level}%</span>
    </div>
  );
};

export const MainDashboard = () => {
  return (
    <div style={{ backgroundColor: '#000', height: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#FFD700', textAlign: 'center' }}>BIORACLE V12</h1>
      <center>
        <HealthBattery level={88} />
        <p style={{ color: '#aaa' }}>Sovereign Status: Optimal</p>
        <button style={{ 
          backgroundColor: '#FFD700', padding: '15px 30px', 
          borderRadius: '30px', fontWeight: 'bold' 
        }}>
          START CLAIM 12 SCAN
        </button>
      </center>
    </div>
  );
};
