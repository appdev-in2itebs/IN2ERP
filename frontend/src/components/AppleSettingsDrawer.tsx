import React, { useState } from 'react';
import { useAuth } from '@/stores/AuthContext';
import { MyApplication } from '@/types';
import { In2ITMark } from './In2ITMark';
import {
  X,
  User,
  Settings,
  Shield,
  Bell,
  Key,
  LogOut,
  CheckCircle,
  Briefcase,
  Building,
  Mail,
  Calendar,
  Sparkles,
  Layers,
  Smartphone,
  Laptop,
} from 'lucide-react';

interface AppleSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  applications: MyApplication[];
}

export const AppleSettingsDrawer: React.FC<AppleSettingsDrawerProps> = ({
  isOpen,
  onClose,
  applications,
}) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'settings'>('details');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');

  if (!isOpen) return null;

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'EM';

  return (
    <div className="apple-drawer-overlay" onClick={onClose}>
      <div className="apple-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="apple-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <In2ITMark size={24} color="#121E3B" />
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#121E3B' }}>
                Employee Portal
              </div>
              <div style={{ fontSize: '0.72rem', color: '#5A6478', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Profile & Settings
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid rgba(18, 30, 59, 0.12)',
              background: 'rgba(18, 30, 59, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#5A6478',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ padding: '16px 28px 0', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'details' ? '#121E3B' : 'rgba(18, 30, 59, 0.05)',
              color: activeTab === 'details' ? '#ffffff' : '#5A6478',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <User size={15} />
            <span>Employee Details</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'settings' ? '#121E3B' : 'rgba(18, 30, 59, 0.05)',
              color: activeTab === 'settings' ? '#ffffff' : '#5A6478',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="apple-drawer-body">
          {activeTab === 'details' ? (
            <div>
              {/* Profile Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #121E3B 0%, #1A2B52 100%)',
                  borderRadius: 20,
                  padding: '24px',
                  color: 'white',
                  marginBottom: 24,
                  boxShadow: '0 12px 30px -8px rgba(18, 30, 59, 0.35)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: -20,
                    bottom: -20,
                    opacity: 0.1,
                  }}
                >
                  <In2ITMark size={140} color="#ffffff" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      background: 'radial-gradient(120% 100% at 30% 15%, #94B8D0 0%, #3F75A3 50%, #121E3B 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: 'white',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                      {user?.first_name} {user?.last_name}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#94B8D0', marginTop: 2 }}>
                      {user?.designation || 'Software Engineer'} &bull; {user?.department || 'Engineering'}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(163, 203, 230, 0.2)',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#A3CBE6',
                        marginTop: 6,
                      }}
                    >
                      <Shield size={11} />
                      <span>{user?.is_superadmin ? 'Super Administrator' : 'Verified Employee'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Identity & Company Data */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A6478' }}>
                  Enterprise Identity Details
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    border: '1px solid rgba(18, 30, 59, 0.08)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={15} color="#3F75A3" /> Official Email
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#121E3B' }}>
                      {user?.email}
                    </span>
                  </div>

                  <div style={{ height: 1, background: 'rgba(18, 30, 59, 0.05)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building size={15} color="#3F75A3" /> Department
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#121E3B' }}>
                      {user?.department || 'Engineering & Products'}
                    </span>
                  </div>

                  <div style={{ height: 1, background: 'rgba(18, 30, 59, 0.05)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Briefcase size={15} color="#3F75A3" /> Designation
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#121E3B' }}>
                      {user?.designation || 'Staff Associate'}
                    </span>
                  </div>

                  <div style={{ height: 1, background: 'rgba(18, 30, 59, 0.05)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={15} color="#3F75A3" /> Account Status
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#2E7D4F',
                        background: '#EAF7EE',
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      Active &bull; Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Scoped Application Roles */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A6478', marginBottom: 12 }}>
                  Application Access & Defined Roles ({applications.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: 14,
                        border: '1px solid rgba(18, 30, 59, 0.08)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: 'var(--aura-gradient-tile)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {app.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#121E3B' }}>
                            {app.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#5A6478' }}>
                            {app.category || 'Business Suite'}
                          </div>
                        </div>
                      </div>

                      <span className={app.access_state === 'ready' ? 'badge-role-staff' : 'badge-role-lead'}>
                        {app.roles.join(', ') || 'Member'}
                        {app.access_state !== 'ready' && ' (pending)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Settings Tab */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Theme Mode */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A6478', marginBottom: 10 }}>
                    Appearance & Theme
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setThemeMode(mode)}
                        style={{
                          padding: '10px',
                          borderRadius: 12,
                          border: themeMode === mode ? '2px solid #3F75A3' : '1px solid rgba(18, 30, 59, 0.1)',
                          background: themeMode === mode ? 'rgba(63, 117, 163, 0.1)' : '#ffffff',
                          color: '#121E3B',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A6478', marginBottom: 10 }}>
                    Preferences & Alerts
                  </div>
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 16,
                      border: '1px solid rgba(18, 30, 59, 0.08)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#121E3B' }}>
                          Email Notifications
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#5A6478' }}>
                          Workflow approvals and status changes
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={emailAlerts}
                        onChange={(e) => setEmailAlerts(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#3F75A3' }}
                      />
                    </div>

                    <div style={{ height: 1, background: 'rgba(18, 30, 59, 0.05)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#121E3B' }}>
                          Security Telemetry Alerts
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#5A6478' }}>
                          Unrecognized logins & permission grants
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={securityAlerts}
                        onChange={(e) => setSecurityAlerts(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#3F75A3' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Security Section */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A6478', marginBottom: 10 }}>
                    Account Security & Session
                  </div>
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 16,
                      border: '1px solid rgba(18, 30, 59, 0.08)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={16} color="#2E7D4F" /> Two-Factor Authentication
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2E7D4F' }}>
                        Enforced (SSO)
                      </span>
                    </div>

                    <div style={{ height: 1, background: 'rgba(18, 30, 59, 0.05)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', color: '#5A6478', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Laptop size={16} color="#3F75A3" /> Active Session
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#5A6478' }}>
                        This Windows PC
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    marginTop: 10,
                    padding: '12px',
                    borderRadius: 14,
                    border: '1px solid #C0392B',
                    background: '#FDF0ED',
                    color: '#C0392B',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out of In2IT ERP</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(18, 30, 59, 0.08)',
            fontSize: '0.74rem',
            color: '#5A6478',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          <span>In2IT EBS | Converged Intelligence</span>
          <span style={{ fontWeight: 600 }}>Confidential</span>
        </div>
      </div>
    </div>
  );
};
