import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/stores/AuthContext';
import { applicationService } from '@/services/applicationService';
import { Application } from '@/types';
import { In2ITMark } from '@/components/In2ITMark';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Monitor,
  Settings,
  LogOut,
  X,
  Check,
  ChevronDown,
  Briefcase,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Layers,
  ArrowRight,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';

type ThemeMode = 'light' | 'auto' | 'dark';
type ColorTheme = 'mauve' | 'aurora' | 'midnight' | 'cosmic';

interface ProfilePreferences {
  notificationChannel: 'email' | 'crm';
  timezone: string;
  celebrationSound: boolean;
  emailSignature: string;
}

export const EtherealLaunchpad: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'preferences' | 'security'>('preferences');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Appearance & Themes
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('in2it_theme_mode') as ThemeMode) || 'light';
  });
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    return (localStorage.getItem('in2it_color_theme') as ColorTheme) || 'mauve';
  });

  // Profile preferences state
  const [preferences, setPreferences] = useState<ProfilePreferences>(() => {
    const saved = localStorage.getItem('in2it_user_preferences');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      notificationChannel: 'email',
      timezone: 'Asia/Kolkata',
      celebrationSound: true,
      emailSignature: 'Regards,\nElisaya Nayak\nIn2IT Enterprise Business Services',
    };
  });

  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch applications
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const myApps = await applicationService.getMyApplications();
        // If myApps is empty (e.g. fresh session), fallback to list of active apps
        if (myApps && myApps.length > 0) {
          setApps(myApps);
        } else {
          const allApps = await applicationService.listApplications({ is_active: true });
          setApps(allApps);
        }
      } catch (err) {
        console.error('Failed to load apps:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const handleSavePreferences = () => {
    localStorage.setItem('in2it_user_preferences', JSON.stringify(preferences));
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 3000);
    setIsProfileModalOpen(false);
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('in2it_theme_mode', mode);
    if (mode === 'dark') {
      setColorTheme('midnight');
      localStorage.setItem('in2it_color_theme', 'midnight');
    } else if (mode === 'light' && colorTheme === 'midnight') {
      setColorTheme('mauve');
      localStorage.setItem('in2it_color_theme', 'mauve');
    }
  };

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme);
    localStorage.setItem('in2it_color_theme', theme);
  };

  // Initials for avatar
  const getInitials = (firstName?: string, lastName?: string) => {
    const f = firstName ? firstName.charAt(0).toUpperCase() : 'E';
    const l = lastName ? lastName.charAt(0).toUpperCase() : 'N';
    return `${f}${l}`;
  };

  const userName = user ? `${user.first_name} ${user.last_name}` : 'Elisaya Nayak';
  const userRole = user?.designation || (user?.is_superadmin ? 'System Administrator' : 'Sales Manager');
  const userEmail = user?.email || 'elisaya.nayak@in2itebs.com';
  const firstName = user?.first_name || 'Elisaya';

  // Render App Icon
  const renderAppIcon = (app: Application) => {
    const slug = app.slug.toLowerCase();
    if (slug.includes('crm') || slug.includes('in2crm')) {
      // Exact In2CRM histogram/pipeline icon from screenshot
      return (
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Baseline */}
          <line x1="3" y1="20" x2="21" y2="20" />
          {/* Left bar (medium) */}
          <rect x="5" y="10" width="3.5" height="10" rx="1.5" fill="none" />
          {/* Middle bar (tall) */}
          <rect x="10.25" y="5" width="3.5" height="15" rx="1.5" fill="none" />
          {/* Right bar (shorter) */}
          <rect x="15.5" y="12" width="3.5" height="8" rx="1.5" fill="none" />
        </svg>
      );
    }
    if (slug.includes('project')) {
      return <Briefcase size={34} color="#FFFFFF" strokeWidth={2.2} />;
    }
    if (slug.includes('hr') || slug.includes('hrm')) {
      return <Users size={34} color="#FFFFFF" strokeWidth={2.2} />;
    }
    if (slug.includes('leave')) {
      return <Calendar size={34} color="#FFFFFF" strokeWidth={2.2} />;
    }
    if (slug.includes('finance')) {
      return <DollarSign size={34} color="#FFFFFF" strokeWidth={2.2} />;
    }
    return <Layers size={34} color="#FFFFFF" strokeWidth={2.2} />;
  };

  const getTileGradient = (app: Application) => {
    const slug = app.slug.toLowerCase();
    if (slug.includes('crm')) {
      // Exact rich plum/burgundy from screenshot
      return 'linear-gradient(135deg, #7A244E 0%, #521634 100%)';
    }
    if (slug.includes('project')) {
      return 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
    }
    if (slug.includes('hr')) {
      return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    }
    if (slug.includes('leave')) {
      return 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)';
    }
    if (slug.includes('finance')) {
      return 'linear-gradient(135deg, #D97706 0%, #B45309 100%)';
    }
    return app.color ? `linear-gradient(135deg, ${app.color} 0%, #1E293B 100%)` : 'linear-gradient(135deg, #7A244E 0%, #521634 100%)';
  };

  const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isAdmin = user?.is_superadmin || hasPermission('employees.read');

  return (
    <div className={`ethereal-wrapper theme-${colorTheme} ${isDark ? 'is-dark' : 'is-light'}`}>
      {/* ─────────────────────────────────────────────────────────────
          1. ANIMATED ETHEREAL BACKGROUND MESH
      ───────────────────────────────────────────────────────────── */}
      <div className="ethereal-bg-container" aria-hidden="true">
        <div className="mesh-gradient-base" />
        <div className="floating-orb orb-mauve" />
        <div className="floating-orb orb-rose" />
        <div className="floating-orb orb-mint" />
        <div className="floating-orb orb-cyan" />
        <div className="floating-orb orb-warm-center" />
        <div className="ethereal-glass-overlay" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="ethereal-header">
        <div className="header-logo-group">
          <In2ITMark size={34} color={isDark ? '#E2E8F0' : '#121E3B'} />
          <div className="header-brand-text">
            <span className="brand-title">In2IT EBS</span>
            <span className="brand-subtitle">CONVERGED INTELLIGENCE</span>
          </div>
        </div>

        <div className="header-actions-group" ref={dropdownRef}>
          {/* Admin console shortcut button */}
          {isAdmin && (
            <button
              onClick={() => navigate('/employees')}
              className="admin-switch-btn"
              title="Open ERP Admin Management Console"
            >
              <ShieldCheck size={16} />
              <span>Admin Console</span>
            </button>
          )}

          {/* User profile capsule button (Exact trigger from Screenshot) */}
          <button
            className={`user-profile-trigger ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="User Profile Menu"
          >
            <div className="profile-avatar-circle">
              <span>{getInitials(user?.first_name, user?.last_name)}</span>
            </div>
            <span className="profile-name-text">{userName}</span>
            <ChevronDown size={14} className={`chevron-icon ${isDropdownOpen ? 'rotated' : ''}`} />
          </button>

          {/* ─────────────────────────────────────────────────────────
              3. USER DROPDOWN POPOVER (Image 2)
          ───────────────────────────────────────────────────────── */}
          {isDropdownOpen && (
            <div className="ethereal-dropdown-menu">
              <div className="dropdown-user-header">
                <div className="user-name">{userName}</div>
                <div className="user-role-badge">{userRole}</div>
                <div className="user-email-text">{userEmail}</div>
              </div>

              <div className="dropdown-divider" />

              <button
                className="dropdown-menu-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsProfileModalOpen(true);
                }}
              >
                <Settings size={16} className="item-icon" />
                <span>My Profile</span>
              </button>

              <div className="dropdown-divider" />

              {/* Appearance segmented control (Exact from Image 2) */}
              <div className="dropdown-section">
                <div className="section-label">Appearance</div>
                <div className="segmented-control">
                  <button
                    className={`segment-btn ${themeMode === 'light' ? 'selected' : ''}`}
                    onClick={() => handleThemeModeChange('light')}
                  >
                    <Sun size={14} />
                    <span>Light</span>
                  </button>
                  <button
                    className={`segment-btn ${themeMode === 'auto' ? 'selected' : ''}`}
                    onClick={() => handleThemeModeChange('auto')}
                  >
                    <Monitor size={14} />
                    <span>Auto</span>
                  </button>
                  <button
                    className={`segment-btn ${themeMode === 'dark' ? 'selected' : ''}`}
                    onClick={() => handleThemeModeChange('dark')}
                  >
                    <Moon size={14} />
                    <span>Dark</span>
                  </button>
                </div>

                {/* Animated Theme Palette Selector */}
                <div className="theme-palette-row">
                  <button
                    className={`theme-chip chip-mauve ${colorTheme === 'mauve' ? 'active' : ''}`}
                    onClick={() => handleColorThemeChange('mauve')}
                    title="Ethereal Mauve (Default)"
                  >
                    <span>Mauve</span>
                  </button>
                  <button
                    className={`theme-chip chip-aurora ${colorTheme === 'aurora' ? 'active' : ''}`}
                    onClick={() => handleColorThemeChange('aurora')}
                    title="Aurora Seafoam"
                  >
                    <span>Aurora</span>
                  </button>
                  <button
                    className={`theme-chip chip-cosmic ${colorTheme === 'cosmic' ? 'active' : ''}`}
                    onClick={() => handleColorThemeChange('cosmic')}
                    title="Sunset Cosmic"
                  >
                    <span>Cosmic</span>
                  </button>
                  <button
                    className={`theme-chip chip-midnight ${colorTheme === 'midnight' ? 'active' : ''}`}
                    onClick={() => handleColorThemeChange('midnight')}
                    title="Midnight Obsidian"
                  >
                    <span>Midnight</span>
                  </button>
                </div>
              </div>

              <div className="dropdown-divider" />

              <button
                className="dropdown-menu-item sign-out-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={16} className="item-icon" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          4. CENTER LAUNCHPAD (Image 1)
      ───────────────────────────────────────────────────────────── */}
      <main className="ethereal-center-content">
        {loading ? (
          <div className="launchpad-loading">
            <div className="launchpad-pulse-spinner" />
            <p>Loading enterprise modules...</p>
          </div>
        ) : (
          <div className="launchpad-container">
            {/* Cards Grid / Center Display */}
            <div className={`launchpad-apps-grid ${apps.length === 1 ? 'single-app-layout' : 'multi-app-layout'}`}>
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="ethereal-app-card"
                  onClick={() => setSelectedApp(app)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelectedApp(app);
                  }}
                >
                  {/* Squircle 3D Icon Tile */}
                  <div className="app-squircle-tile" style={{ background: getTileGradient(app) }}>
                    <div className="tile-specular-highlight" />
                    {renderAppIcon(app)}
                  </div>

                  {/* App Title */}
                  <h2 className="app-card-title">{app.name}</h2>

                  {/* App Tagline / Pipeline description */}
                  <p className="app-card-tagline">
                    {app.description || 'ENTERPRISE MODULE V2.0'}
                  </p>

                  {/* Optional Scoped Role Pill if assigned */}
                  {app.user_app_role && (
                    <div className="app-scoped-role-pill">
                      <span>{app.user_app_role}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Welcome Greeting under the card(s) */}
            <div className="launchpad-welcome-text">
              Welcome, {firstName}
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          5. BOTTOM FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="ethereal-footer">
        <span>IN2IT ENTERPRISE BUSINESS SERVICES</span>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          6. MY PROFILE MODAL (Exact replica of Image 3)
      ───────────────────────────────────────────────────────────── */}
      {isProfileModalOpen && (
        <div className="ethereal-modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div
            className="ethereal-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="profile-modal-title"
          >
            {/* Modal Header */}
            <div className="modal-header">
              <h2 id="profile-modal-title" className="modal-title">
                My Profile
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsProfileModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* User Identity Section */}
              <div className="profile-identity-section">
                <div className="profile-big-avatar">
                  <UserIcon size={32} color="#64748B" />
                </div>
                <div className="profile-identity-details">
                  <h3 className="identity-name">{userName}</h3>
                  <div className="identity-role">{userRole}</div>
                  <p className="identity-notice">
                    {userEmail} • your name, email and role are set by an administrator
                  </p>
                </div>
              </div>

              {/* Pill Navigation Tabs */}
              <div className="profile-pill-tabs">
                <button
                  className={`tab-pill ${activeModalTab === 'preferences' ? 'active' : ''}`}
                  onClick={() => setActiveModalTab('preferences')}
                >
                  Preferences
                </button>
                <button
                  className={`tab-pill ${activeModalTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveModalTab('security')}
                >
                  Account Security
                </button>
              </div>

              {/* Tab 1: Preferences */}
              {activeModalTab === 'preferences' && (
                <div className="tab-content">
                  {/* Notifications */}
                  <div className="form-group">
                    <label className="form-label">Notifications</label>
                    <div className="radio-options-stack">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="notificationChannel"
                          value="email"
                          checked={preferences.notificationChannel === 'email'}
                          onChange={() =>
                            setPreferences({ ...preferences, notificationChannel: 'email' })
                          }
                        />
                        <span>Send them to my email</span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="notificationChannel"
                          value="crm"
                          checked={preferences.notificationChannel === 'crm'}
                          onChange={() =>
                            setPreferences({ ...preferences, notificationChannel: 'crm' })
                          }
                        />
                        <span>Keep them in In2CRM only</span>
                      </label>
                    </div>
                    <span className="field-hint">Mentions, approvals and the daily digest</span>
                  </div>

                  {/* Timezone */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="timezone-select">
                      Timezone
                    </label>
                    <div className="select-wrapper">
                      <select
                        id="timezone-select"
                        className="form-select"
                        value={preferences.timezone}
                        onChange={(e) =>
                          setPreferences({ ...preferences, timezone: e.target.value })
                        }
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="UTC">UTC (Universal Coordinated Time)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      </select>
                      <ChevronDown size={14} className="select-chevron" />
                    </div>
                    <span className="field-hint">
                      How dates are written into digest mail and meeting invitations
                    </span>
                  </div>

                  {/* When a deal is won */}
                  <div className="form-group">
                    <label className="form-label">When a deal is won</label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.celebrationSound}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            celebrationSound: e.target.checked,
                          })
                        }
                      />
                      <span>Play the celebration</span>
                    </label>
                    <span className="field-hint">
                      Stored on this device — turn it off before a client demo
                    </span>
                  </div>

                  {/* Email signature */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="email-signature">
                      Email signature
                    </label>
                    <textarea
                      id="email-signature"
                      className="form-textarea"
                      rows={3}
                      value={preferences.emailSignature}
                      placeholder="Regards, ..."
                      onChange={(e) =>
                        setPreferences({ ...preferences, emailSignature: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Account Security */}
              {activeModalTab === 'security' && (
                <div className="tab-content">
                  <div className="security-info-box">
                    <ShieldCheck size={28} color="#6B2144" />
                    <div>
                      <div className="security-title">Enterprise Single Sign-On Enabled</div>
                      <div className="security-desc">
                        Authentication is managed by In2IT EBS Converged Directory with Argon2id encryption.
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Active Session</label>
                    <div className="session-item">
                      <div className="session-dot" />
                      <div className="session-text">
                        <strong>Current Device</strong> — Chrome on Windows • IP Verified Bom06
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-save"
                onClick={handleSavePreferences}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. APPLICATION WORKSPACE PREVIEW MODAL
      ───────────────────────────────────────────────────────────── */}
      {selectedApp && (
        <div className="ethereal-modal-backdrop" onClick={() => setSelectedApp(null)}>
          <div
            className="ethereal-app-workspace-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="app-workspace-header">
              <div className="app-workspace-title-group">
                <div
                  className="app-mini-tile"
                  style={{ background: getTileGradient(selectedApp) }}
                >
                  {renderAppIcon(selectedApp)}
                </div>
                <div>
                  <h3 className="workspace-app-name">{selectedApp.name}</h3>
                  <div className="workspace-app-meta">
                    {selectedApp.description} • Role: <strong>{selectedApp.user_app_role || userRole}</strong>
                  </div>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="app-workspace-body">
              {/* If In2CRM is clicked: showcase live CRM pipeline dashboard */}
              {selectedApp.slug.includes('crm') ? (
                <div className="crm-preview-content">
                  <div className="crm-kpi-grid">
                    <div className="crm-kpi-card">
                      <span className="kpi-label">Pipeline Value</span>
                      <span className="kpi-val">$1,420,000</span>
                      <span className="kpi-trend positive">+14.2% MoM</span>
                    </div>
                    <div className="crm-kpi-card">
                      <span className="kpi-label">Active Deals</span>
                      <span className="kpi-val">18</span>
                      <span className="kpi-trend">In Negotiation</span>
                    </div>
                    <div className="crm-kpi-card">
                      <span className="kpi-label">Win Rate</span>
                      <span className="kpi-val">68.4%</span>
                      <span className="kpi-trend positive">Above Target</span>
                    </div>
                    <div className="crm-kpi-card">
                      <span className="kpi-label">Revenue Target</span>
                      <span className="kpi-val">$850,000</span>
                      <span className="kpi-trend">Q4 Target</span>
                    </div>
                  </div>

                  <div className="crm-stages-flow">
                    <div className="stage-step active">
                      <div className="stage-num">01</div>
                      <div className="stage-name">Qualified Leads (42)</div>
                    </div>
                    <div className="stage-step active">
                      <div className="stage-num">02</div>
                      <div className="stage-name">Proposal Submitted (12)</div>
                    </div>
                    <div className="stage-step active">
                      <div className="stage-num">03</div>
                      <div className="stage-name">Final Negotiation (6)</div>
                    </div>
                    <div className="stage-step won">
                      <div className="stage-num">04</div>
                      <div className="stage-name">Closed Won ($380K)</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="generic-app-preview">
                  <div className="generic-app-status">
                    <CheckCircle2 size={36} color="#10B981" />
                    <h4>Workspace Licensed & Active</h4>
                    <p>
                      You are authenticated as <strong>{userName}</strong> ({userRole}) with full operational privileges on {selectedApp.name}.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="app-workspace-footer">
              <button
                className="btn-launch-secondary"
                onClick={() => setSelectedApp(null)}
              >
                Close View
              </button>
              <button
                className="btn-launch-primary"
                style={{ background: getTileGradient(selectedApp) }}
                onClick={() => {
                  alert(`Launching full production instance for ${selectedApp.name}...`);
                  setSelectedApp(null);
                }}
              >
                <span>Enter Workspace</span>
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {saveSuccessToast && (
        <div className="ethereal-toast">
          <Check size={16} />
          <span>Preferences saved successfully</span>
        </div>
      )}
    </div>
  );
};
