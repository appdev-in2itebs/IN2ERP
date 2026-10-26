import React, { useEffect, useState } from 'react';
import { dashboardService } from '@/services/dashboardService';
import { applicationService } from '@/services/applicationService';
import { DashboardStats, Application } from '@/types';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/stores/AuthContext';
import { useNavigate } from 'react-router-dom';
import { In2ITMark } from '@/components/In2ITMark';
import { AppleSettingsDrawer } from '@/components/AppleSettingsDrawer';
import {
  Users,
  Grid,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  PlusCircle,
  Database,
  Cloud,
  Briefcase,
  Building,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Sliders,
  User,
  Settings,
  Layers,
  Clock,
  ChevronRight,
  Shield,
  Activity,
  Code,
  FileCheck,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingApp, setLaunchingApp] = useState<Application | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const isEmployeeOnly = !user?.is_superadmin && !hasPermission('employees.read');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isEmployeeOnly) {
          // Employee: load only assigned applications
          const myApps = await applicationService.getMyApplications();
          setApps(myApps);
        } else {
          // Admin: load all active apps & system-wide telemetry
          const [statsData, appsData] = await Promise.all([
            dashboardService.getStats(),
            applicationService.listApplications({ is_active: true }),
          ]);
          setStats(statsData);
          setApps(appsData);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isEmployeeOnly]);

  if (loading) {
    return <LoadingSpinner message="Connecting to In2IT Converged Intelligence..." />;
  }

  // ════════════════════════════════════════════════════════════════════
  // 1. EMPLOYEE APPLE & ODOO-STYLE LAUNCHPAD
  // ════════════════════════════════════════════════════════════════════
  if (isEmployeeOnly) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 40 }}>
        {/* Apple Cupertino Control Bar */}
        <div
          className="apple-glass-card"
          style={{
            padding: '22px 28px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #121E3B 0%, #1A2B52 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(18, 30, 59, 0.25)',
              }}
            >
              <In2ITMark size={28} color="#94B8D0" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="newsreader" style={{ fontSize: '1.65rem', fontWeight: 700, color: '#121E3B', margin: 0 }}>
                  Good day, <span className="newsreader-italic">{user?.first_name}</span>
                </h2>
                <span
                  style={{
                    background: '#EAF7EE',
                    color: '#2E7D4F',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    border: '1px solid #A3DFB8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2E7D4F' }} />
                  Verified Session
                </span>
              </div>
              <p style={{ color: '#5A6478', fontSize: '0.86rem', marginTop: 3 }}>
                {user?.designation || 'Staff Associate'} &bull; {user?.department || 'Engineering'} &bull; In2IT EBS Workspace
              </p>
            </div>
          </div>

          {/* Side Drawer Trigger Button */}
          <button
            type="button"
            className="apple-control-btn"
            onClick={() => setIsDrawerOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid rgba(18, 30, 59, 0.12)',
              boxShadow: '0 4px 12px rgba(18, 30, 59, 0.06)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--aura-gradient-tile)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.76rem',
              }}
            >
              {user?.first_name?.[0]}
              {user?.last_name?.[0]}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#121E3B', lineHeight: 1.2 }}>
                My Details & Settings
              </div>
              <div style={{ fontSize: '0.7rem', color: '#5A6478' }}>
                Profile, ID & Preferences
              </div>
            </div>
            <Sliders size={16} color="#3F75A3" />
          </button>
        </div>

        {/* Main Applications Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
          {/* Applications Launchpad Grid */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 className="newsreader" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#121E3B', margin: 0 }}>
                  Assigned <span className="newsreader-italic">Applications</span>
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#5A6478', marginTop: 2 }}>
                  You have access to <strong>{apps.length}</strong> enterprise modules configured by administrator.
                </p>
              </div>

              <span className="badge badge-primary">
                {apps.length} Active Module{apps.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {apps.map((app) => {
                const isLead = app.user_app_role?.toLowerCase().includes('lead');
                const isStaff = app.user_app_role?.toLowerCase().includes('staff') || app.user_app_role?.toLowerCase().includes('requester');

                return (
                  <div
                    key={app.id}
                    className="apple-launch-card"
                    onClick={() => setLaunchingApp(app)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      {/* Card Header with 3D Glossy Icon Tile */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div className="aura-glossy-tile">
                          <Grid size={32} />
                        </div>

                        {/* Application Role Badge defined by Admin */}
                        <div style={{ textAlign: 'right' }}>
                          <span
                            className={
                              isLead
                                ? 'badge-role-lead'
                                : isStaff
                                ? 'badge-role-staff'
                                : 'badge-role-admin'
                            }
                          >
                            <Shield size={12} />
                            <span>Role: {app.user_app_role || 'Member'}</span>
                          </span>
                          <div style={{ fontSize: '0.7rem', color: '#5A6478', marginTop: 4 }}>
                            Admin Defined Access
                          </div>
                        </div>
                      </div>

                      {/* Title & Category */}
                      <div style={{ marginBottom: 12 }}>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#121E3B', margin: 0 }}>
                          {app.name}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: '#3F75A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
                          {app.category || 'Business Suite'}
                        </div>
                      </div>

                      <p style={{ fontSize: '0.86rem', color: '#5A6478', lineHeight: 1.5, marginBottom: 20 }}>
                        {app.description || 'Enterprise module workspace.'}
                      </p>
                    </div>

                    {/* Launch Action Footer */}
                    <div
                      style={{
                        paddingTop: 16,
                        borderTop: '1px solid rgba(18, 30, 59, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#2E7D4F', fontWeight: 600 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2E7D4F' }} />
                        <span>Active &bull; Licensed</span>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{
                          background: 'linear-gradient(180deg, #5A8DB8 0%, #3F75A3 100%)',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: 10,
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(63, 117, 163, 0.3)',
                        }}
                      >
                        <span>Open Module</span>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {apps.length === 0 && (
                <div
                  className="apple-glass-card"
                  style={{ gridColumn: '1 / -1', padding: '60px 24px', textAlign: 'center', color: '#5A6478' }}
                >
                  <Grid size={44} style={{ margin: '0 auto 12px', color: '#94B8D0' }} />
                  <h3 className="newsreader" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#121E3B' }}>
                    No Applications Assigned Yet
                  </h3>
                  <p style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: 440, margin: '6px auto 0' }}>
                    Your employee account has not yet been allocated module permissions. Please request module access from your administrator.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Side Info & Settings Quick Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Quick Profile Card */}
            <div
              className="apple-glass-card"
              style={{
                padding: '24px',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(247, 248, 250, 0.95) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3F75A3' }}>
                  Employee Identity
                </span>
                <span
                  style={{
                    background: '#EAF7EE',
                    color: '#2E7D4F',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  Verified
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'var(--aura-gradient-tile)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#121E3B' }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#5A6478' }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem', color: '#5A6478', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Department:</span>
                  <strong style={{ color: '#121E3B' }}>{user?.department || 'Engineering'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Designation:</span>
                  <strong style={{ color: '#121E3B' }}>{user?.designation || 'Staff Associate'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Active Apps:</span>
                  <strong style={{ color: '#3F75A3' }}>{apps.length} Modules</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDrawerOpen(true)}
                style={{ width: '100%', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Sliders size={14} />
                <span>Open Side Settings Drawer</span>
              </button>
            </div>

            {/* In2IT EBS Trust & Security Note */}
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 16,
                background: 'rgba(63, 117, 163, 0.08)',
                border: '1px solid rgba(63, 117, 163, 0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={18} color="#3F75A3" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#121E3B' }}>
                  Role-Based Security
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#5A6478', lineHeight: 1.45, margin: 0 }}>
                Your scoped roles (e.g. <strong>Project Lead</strong> vs <strong>Requester</strong>) are governed directly by IT Admin policy.
              </p>
            </div>
          </div>
        </div>

        {/* Apple Settings Slide-Over Drawer */}
        <AppleSettingsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          applications={apps}
        />

        {/* Modal: Simulated Application Workspace */}
        <Modal
          isOpen={!!launchingApp}
          onClose={() => setLaunchingApp(null)}
          title={`In2IT Module: ${launchingApp?.name || ''}`}
        >
          <div className="modal-body" style={{ padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div className="aura-glossy-tile" style={{ width: 56, height: 56 }}>
                <Grid size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#121E3B', margin: 0 }}>
                  {launchingApp?.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="badge-role-lead">
                    Assigned Role: {launchingApp?.user_app_role || 'Member'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#5A6478' }}>
                    Category: {launchingApp?.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Interactive Preview depending on App */}
            {launchingApp?.slug === 'project-mgmt' ? (
              <div style={{ background: '#F7F8FA', borderRadius: 14, padding: 18, border: '1px solid rgba(18, 30, 59, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#121E3B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Code size={16} color="#3F75A3" /> Project Lead Sprint Board
                  </span>
                  <span className="badge badge-success">Sprint #44 Active</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ background: 'white', padding: 10, borderRadius: 10, border: '1px solid rgba(18, 30, 59, 0.06)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#121E3B' }}>14</div>
                    <div style={{ fontSize: '0.72rem', color: '#5A6478' }}>Tasks in Progress</div>
                  </div>
                  <div style={{ background: 'white', padding: 10, borderRadius: 10, border: '1px solid rgba(18, 30, 59, 0.06)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2E7D4F' }}>28</div>
                    <div style={{ fontSize: '0.72rem', color: '#5A6478' }}>Completed Story Pts</div>
                  </div>
                  <div style={{ background: 'white', padding: 10, borderRadius: 10, border: '1px solid rgba(18, 30, 59, 0.06)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3F75A3' }}>2</div>
                    <div style={{ fontSize: '0.72rem', color: '#5A6478' }}>Lead Reviews Req.</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#5A6478' }}>
                  ✓ As <strong>Project Lead</strong>, you have permissions to merge sprints, approve tickets, and assign tasks to engineers.
                </div>
              </div>
            ) : launchingApp?.slug === 'leave-mgmt' ? (
              <div style={{ background: '#F7F8FA', borderRadius: 14, padding: 18, border: '1px solid rgba(18, 30, 59, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#121E3B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} color="#3F75A3" /> Self-Service Leave Portal
                  </span>
                  <span className="badge badge-success">Compliant</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ background: 'white', padding: 12, borderRadius: 10, border: '1px solid rgba(18, 30, 59, 0.06)' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3F75A3' }}>18 Days</div>
                    <div style={{ fontSize: '0.74rem', color: '#5A6478' }}>Available Paid Time Off</div>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 10, border: '1px solid rgba(18, 30, 59, 0.06)' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2E7D4F' }}>10 Days</div>
                    <div style={{ fontSize: '0.74rem', color: '#5A6478' }}>Sick & Wellness Leave</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#5A6478' }}>
                  ✓ As <strong>Requester / Staff</strong>, you can submit time off requests, check public holidays, and review balance statements.
                </div>
              </div>
            ) : (
              <div style={{ background: '#F7F8FA', borderRadius: 14, padding: 18, border: '1px solid rgba(18, 30, 59, 0.08)' }}>
                <div style={{ fontSize: '0.86rem', color: '#5A6478', lineHeight: 1.5 }}>
                  Access authorized under role <strong>{launchingApp?.user_app_role || 'Member'}</strong>. Module is ready for live ERP data flow.
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setLaunchingApp(null)}>
              Dismiss
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                window.alert(`Navigating into full ${launchingApp?.name} environment!`);
                setLaunchingApp(null);
              }}
            >
              Open Full Workspace
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. ADMIN & SUPERADMIN SYSTEM CONTROL CENTER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Admin Welcome Banner with In2IT EBS Header Gradient */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1A2B52 0%, #121E3B 55%, #0B1328 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(163, 203, 230, 0.15)',
              border: '1px solid rgba(163, 203, 230, 0.3)',
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#A3CBE6',
              marginBottom: 12,
            }}
          >
            <In2ITMark size={14} color="#A3CBE6" />
            <span>Converged Intelligence Platform</span>
          </div>

          <h1 className="newsreader" style={{ fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Enterprise <span className="newsreader-italic">Control Center</span>
          </h1>

          <p style={{ color: '#94B8D0', marginTop: 6, fontSize: '0.94rem', maxWidth: 600 }}>
            Governance, granular role assignments, and application entitlements across all business units.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 2 }}>
          <button
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(180deg, #5A8DB8 0%, #3F75A3 100%)',
              border: 'none',
              boxShadow: '0 8px 20px rgba(63, 117, 163, 0.4)',
            }}
            onClick={() => navigate('/assignments')}
          >
            <PlusCircle size={18} />
            <span>Manage App Roles</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <StatCard
          label="Total Employees"
          value={stats?.total_employees || 0}
          icon={<Users size={22} />}
          color="#121E3B"
          bg="rgba(18, 30, 59, 0.1)"
        />

        <StatCard
          label="Enterprise Applications"
          value={stats?.total_applications || 0}
          icon={<Grid size={22} />}
          color="#3F75A3"
          bg="rgba(63, 117, 163, 0.12)"
        />

        <StatCard
          label="Active Assignments"
          value={stats?.total_assignments || 0}
          icon={<CheckCircle2 size={22} />}
          color="#2E7D4F"
          bg="rgba(46, 125, 79, 0.12)"
        />

        <StatCard
          label="Recent Audit Events"
          value={stats?.recent_activity_count || 0}
          icon={<ShieldAlert size={22} />}
          color="#B9770E"
          bg="rgba(185, 119, 14, 0.12)"
        />
      </div>

      {/* Applications Catalog Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 className="newsreader" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#121E3B', margin: 0 }}>
              Enterprise <span className="newsreader-italic">Applications</span> Catalog
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#5A6478', marginTop: 2 }}>
              Centralized module catalog with role assignment controls.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/applications')}
          >
            <span>View All Applications</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {apps.slice(0, 6).map((app) => (
            <div key={app.id} className="app-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div className="aura-glossy-tile" style={{ width: 50, height: 50, borderRadius: 14 }}>
                    <Grid size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#121E3B' }}>
                      {app.name}
                    </h4>
                    <span className="badge badge-neutral" style={{ marginTop: 2 }}>
                      {app.category || 'General'}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.84rem', color: '#5A6478', lineHeight: 1.45, marginBottom: 16 }}>
                  {app.description || 'Enterprise module.'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: '1px solid rgba(18, 30, 59, 0.08)',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: '#5A6478' }}>
                  {app.assigned_users || 0} users assigned
                </span>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/assignments')}
                >
                  Manage Access
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
