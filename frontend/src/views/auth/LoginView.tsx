import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import { useNotification } from '@/stores/NotificationContext';
import { errorMessage } from '@/services/apiClient';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

const iconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-dim)',
};

const MicrosoftMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginWithMicrosoft, config, isLoading } = useAuth();
  const { error } = useNotification();
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
      navigate('/');
    } catch (err) {
      error(errorMessage(err, 'Sign-in failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoft = async () => {
    setLoading(true);
    try {
      await loginWithMicrosoft();
    } catch (err) {
      error(errorMessage(err, 'Microsoft sign-in could not start.'));
      setLoading(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {config.entra_enabled && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleMicrosoft}
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 14,
            fontSize: '0.94rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#ffffff',
          }}
        >
          <MicrosoftMark />
          <span>Sign in with Microsoft</span>
        </button>
      )}

      {config.entra_enabled && config.local_login_enabled && (
        <div style={{ textAlign: 'center', margin: '18px 0 6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Administrator break-glass sign-in
        </div>
      )}

      {config.local_login_enabled && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={iconStyle} />
              <input
                type="email"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="name@company.com"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={iconStyle} />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="••••••••"
                autoComplete="current-password"
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
        </form>
      )}

      {!config.entra_enabled && !config.local_login_enabled && (
        <p style={{ textAlign: 'center', color: 'var(--danger)' }}>
          Sign-in is not configured. Contact your ERP administrator.
        </p>
      )}

      {config.self_registration_enabled && (
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: '#64748b' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create an Account
          </Link>
        </div>
      )}
    </div>
  );
};
