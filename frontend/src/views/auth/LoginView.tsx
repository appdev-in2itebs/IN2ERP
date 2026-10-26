import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import { useNotification } from '@/stores/NotificationContext';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('admin@in2it.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { error, success } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      success('Welcome back to In2IT ERP', 'Authentication Successful');
      navigate('/');
    } catch (err: any) {
      error(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Work Email</label>
        <div style={{ position: 'relative' }}>
          <Mail
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)',
            }}
          />
          <input
            type="email"
            className="form-control"
            style={{ paddingLeft: 38 }}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
        </div>
        <div style={{ position: 'relative' }}>
          <Lock
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)',
            }}
          />
          <input
            type="password"
            className="form-control"
            style={{ paddingLeft: 38 }}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '13px',
          marginTop: 16,
          background: 'linear-gradient(180deg, #5A8DB8 0%, #3F75A3 100%)',
          borderRadius: 14,
          fontSize: '0.94rem',
          fontWeight: 700,
          boxShadow: '0 8px 24px -4px rgba(63, 117, 163, 0.45)',
          border: 'none',
        }}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Verifying session...</span>
          </>
        ) : (
          <>
            <span>Sign In to Converged Intelligence</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>

      {/* Quick Demo Credential Helper */}
      <div
        style={{
          marginTop: 26,
          padding: 16,
          background: 'rgba(18, 30, 59, 0.03)',
          borderRadius: 18,
          border: '1px solid rgba(18, 30, 59, 0.08)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ fontWeight: 700, color: '#121E3B', marginBottom: 10, textAlign: 'center' }}>
          Select Demo Persona to Test:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setEmail('admin@in2it.com');
              setPassword('admin123');
            }}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              height: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              borderRadius: 12,
              background: '#ffffff',
              border: email === 'admin@in2it.com' ? '2px solid #3F75A3' : '1px solid rgba(18, 30, 59, 0.1)',
            }}
          >
            <span style={{ fontWeight: 700, color: '#121E3B', fontSize: '0.84rem' }}>👑 Super Admin</span>
            <span style={{ fontSize: '0.72rem', color: '#5A6478', marginTop: 2 }}>Administer roles & apps</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setEmail('employee@in2it.com');
              setPassword('employee123');
            }}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              height: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              borderRadius: 12,
              background: '#ffffff',
              border: email === 'employee@in2it.com' ? '2px solid #3F75A3' : '1px solid rgba(18, 30, 59, 0.1)',
            }}
          >
            <span style={{ fontWeight: 700, color: '#2E7D4F', fontSize: '0.84rem' }}>👤 Employee (Alex)</span>
            <span style={{ fontSize: '0.72rem', color: '#5A6478', marginTop: 2 }}>2 Apps (Lead & Requester)</span>
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: '#64748b' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Create an Account
        </Link>
      </div>
    </form>
  );
};
