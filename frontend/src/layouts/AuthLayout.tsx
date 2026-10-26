import React from 'react';
import { Outlet } from 'react-router-dom';
import { ToastContainer } from '@/components/ToastContainer';
import { In2ITMark } from '@/components/In2ITMark';

export const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(120% 90% at 50% -20%, #1A2B52 0%, #121E3B 50%, #0B1328 100%)',
        padding: '32px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(63, 117, 163, 0.22) 0%, transparent 70%)',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRadius: 28,
          padding: '42px 36px',
          boxShadow: '0 28px 70px -15px rgba(11, 19, 40, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 14,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #121E3B 0%, #1A2B52 100%)',
              boxShadow: '0 10px 24px rgba(18, 30, 59, 0.35)',
              marginBottom: 16,
            }}
          >
            <In2ITMark size={40} color="#94B8D0" />
          </div>

          <h1 className="newsreader" style={{ fontSize: '1.85rem', fontWeight: 700, color: '#121E3B', letterSpacing: '-0.02em', margin: 0 }}>
            Converged <span className="newsreader-italic">Intelligence</span>
          </h1>

          <p style={{ fontSize: '0.86rem', color: '#5A6478', marginTop: 4 }}>
            In2IT EBS &bull; Enterprise Resource Management
          </p>
        </div>

        <Outlet />
      </div>

      {/* Brand Footer */}
      <div
        style={{
          marginTop: 28,
          fontSize: '0.76rem',
          color: '#94B8D0',
          display: 'flex',
          gap: 16,
          zIndex: 10,
          letterSpacing: '0.04em',
        }}
      >
        <span>In2IT EBS | Converged Intelligence</span>
        <span>&bull;</span>
        <span>Confidential</span>
      </div>

      <ToastContainer />
    </div>
  );
};
