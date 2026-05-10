import React from 'react';

export const IdentityScan = () => {
  return (
    <div style={{ backgroundColor: '#000', color: '#FFD700', padding: '20px', textAlign: 'center' }}>
      <h2>BIOMETRIC IDENTITY</h2>
      <div style={{ 
        width: '250px', height: '350px', border: '2px solid #FFD700', 
        margin: '0 auto', borderRadius: '20px', position: 'relative',
        boxShadow: '0 0 15px #FFD700'
      }}>
        <div style={{ 
          position: 'absolute', top: '50%', left: '0', width: '100%', 
          height: '2px', backgroundColor: '#FFD700', animation: 'scan 2s infinite' 
        }} />
      </div>
      <p style={{ marginTop: '20px', color: '#fff' }}>POSITION FINGER OVER LENS</p>
      <button style={{ 
        backgroundColor: '#FFD700', color: '#000', border: 'none', 
        padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold' 
      }}>CAPTURE PATTERN</button>
    </div>
  );
};
