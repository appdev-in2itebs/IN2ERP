import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useNotification } from '@/stores/NotificationContext';
import { errorMessage } from '@/services/apiClient';

/**
 * Shown when an account signs in with a one-time password. The API refuses every other
 * request until the password is changed; other sessions are signed out on success.
 */
export const ChangePasswordView: React.FC = () => {
  const { changePassword, config, user } = useAuth();
  const { error, success } = useNotification();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const minLength = config?.password_min_length ?? 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      error('The new passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      success('Your password has been updated');
      navigate('/');
    } catch (err) {
      error(errorMessage(err, 'Could not change your password'));
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <Lock
          size={18}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
        />
        <input
          type="password"
          className="form-control"
          style={{ paddingLeft: 38 }}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => set(e.target.value)}
          required
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18, fontSize: '0.86rem' }}>
        <ShieldCheck size={20} color="#3F75A3" style={{ flexShrink: 0 }} />
        <span>
          {user?.must_change_password
            ? 'You signed in with a one-time password. Choose a new password to continue.'
            : 'Choose a new password. Your other sessions will be signed out.'}{' '}
          Use at least {minLength} characters, including a letter and a digit.
        </span>
      </div>
      {field('Current (one-time) password', current, setCurrent, 'current-password')}
      {field('New password', next, setNext, 'new-password')}
      {field('Confirm new password', confirm, setConfirm, 'new-password')}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 13, marginTop: 12 }} disabled={saving}>
        {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Update password'}
      </button>
    </form>
  );
};
