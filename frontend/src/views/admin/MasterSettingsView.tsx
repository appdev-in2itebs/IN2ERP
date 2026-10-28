import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/stores/AuthContext';
import { userService } from '@/services/userService';
import { roleService } from '@/services/roleService';
import { applicationService } from '@/services/applicationService';
import { assignmentService } from '@/services/assignmentService';
import { auditService } from '@/services/auditService';
import { errorMessage } from '@/services/apiClient';
import {
  User,
  Role,
  Application,
  Assignment,
  AuditLog,
  IntegrationType,
  PlannedChange,
  GrantItem,
  ProvisioningStatus,
  PROVISIONING_LABELS,
  INTEGRATION_LABELS,
} from '@/types';
import { In2ITMark } from '@/components/In2ITMark';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Plus,
  RotateCcw,
  Layers,
  Shield,
  ShieldCheck,
  Users,
  Grid,
  LayoutGrid,
  List,
  Phone,
  Bot,
  Bell,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  X,
  Check,
  Sliders,
  Send,
  Lock,
  History,
  Building,
  DollarSign,
  UserCheck,
  Mail,
  PlusCircle,
  Key,
  Copy,
  Trash2,
  RefreshCw,
  Plug,
  AlertTriangle,
  Link2,
  Power,
} from 'lucide-react';
import './accessConsole.css';

// Users & access, Roles & permissions, Applications & Registry, Master lists, AI assistant, Email templates, Notifications
export type MainTab =
  | 'users'
  | 'roles'
  | 'applications'
  | 'master_lists'
  | 'ai_assistant'
  | 'email_templates'
  | 'notifications';

export type RolesSubTab =
  | 'roles_list'
  | 'role_matrix'
  | 'permission_sets'
  | 'user_assignment'
  | 'data_scopes'
  | 'approval_permissions'
  | 'permissions'
  | 'audit_log';

/** Grant/revoke key for one application role. */
const roleKey = (appId: string, roleId: string) => `${appId}:${roleId}`;

const ProvisioningBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const meta = PROVISIONING_LABELS[(status || 'pending') as ProvisioningStatus] ?? {
    label: status || 'Unknown',
    tone: 'muted' as const,
  };
  return <span className={`prov-badge ${meta.tone}`}>{meta.label}</span>;
};

/** Shown on screens that have no backend yet: nothing here is saved or enforced. */
const PlannedBanner: React.FC<{ what: string }> = ({ what }) => (
  <div className="planned-banner">
    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
    <div>
      <strong>Planned — not saved or enforced.</strong> {what} has no backend yet. Values shown here are
      examples for design review only; changing them has no effect on any application.
    </div>
  </div>
);

const NOT_AVAILABLE = 'Not available yet: this feature has no backend';

interface OneTimePassword {
  user: User;
  password: string;
  reason: 'created' | 'reset';
}

const emptyNewApp = {
  name: '',
  slug: '',
  category: 'Operations',
  description: '',
  themeColor: '#0284C7',
  url: '',
  requiresLicense: false,
  integrationType: 'manual' as IntegrationType,
  baseUrl: '',
  servicePrincipalId: '',
  secretRef: '',
  rolesString: '',
};

const emptyUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  department: 'Sales',
  designation: '',
  phone: '',
};

export const MasterSettingsView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<MainTab>('users');
  const [rolesSubTab, setRolesSubTab] = useState<RolesSubTab>('roles_list');

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Employee Console (List vs Kanban & Department Filters)
  const [employeeViewMode, setEmployeeViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  // Modals & Drawers
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isRegisterAppOpen, setIsRegisterAppOpen] = useState(false);
  const [managingRolesAppId, setManagingRolesAppId] = useState<string | null>(null);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [newRoleExternalId, setNewRoleExternalId] = useState('');
  const [connectorResult, setConnectorResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // One-time password (shown exactly once after create/reset)
  const [oneTimePassword, setOneTimePassword] = useState<OneTimePassword | null>(null);
  const [openAccessAfterPassword, setOpenAccessAfterPassword] = useState<User | null>(null);

  // Employee access editor
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [accessAssignments, setAccessAssignments] = useState<Assignment[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>({});
  const [expiryByApp, setExpiryByApp] = useState<Record<string, string>>({});
  const [plannedChanges, setPlannedChanges] = useState<PlannedChange[] | null>(null);
  const [profileForm, setProfileForm] = useState({ ...emptyUserForm });
  const [entraForm, setEntraForm] = useState({ objectId: '', tenantId: '' });

  // Forms
  const [newAppForm, setNewAppForm] = useState({ ...emptyNewApp });
  const [userForm, setUserForm] = useState({ ...emptyUserForm });

  // Placeholder tabs (no backend): local, never saved
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('welcome');
  const [emailTemplates, setEmailTemplates] = useState({
    welcome: {
      title: 'New Employee Onboarding & Application Access',
      subject: 'Welcome to In2IT EBS — your In2ERP access',
      body: `Dear {{employee_name}},\n\nYour In2ERP account has been created.\n\nApplications granted to you:\n{{assigned_apps_list}}\n\nSign in with your corporate Microsoft account at:\n{{login_url}}\n\nIn2IT ERP Administration`,
    },
    role_change: {
      title: 'Application Roles Changed',
      subject: 'Your In2ERP application access has changed',
      body: `Dear {{employee_name}},\n\nYour application roles have been updated:\n{{assigned_apps_list}}\n\nIf you did not expect this change, contact the IT Security Desk.\n\nIn2IT Security & Governance`,
    },
    password_reset: {
      title: 'Password Reset',
      subject: 'In2ERP password reset',
      body: `Hello {{employee_name}},\n\nA password reset was requested for {{employee_email}}.\n\n{{reset_url}}\n\nIn2IT Identity & Access Management`,
    },
  });
  const [broadcastForm, setBroadcastForm] = useState({ title: '', targetApp: 'all', message: '' });
  const [aiTestPrompt, setAiTestPrompt] = useState('');

  // Audit (Roles › Audit Log sub-tab)
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);

  const managingRolesApp = apps.find((a) => a.id === managingRolesAppId) ?? null;

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), error ? 6000 : 3500);
  };

  // Fetch initial data
  const loadData = async () => {
    try {
      const [usersData, rolesData, appsData] = await Promise.all([
        userService.listUsers({ page: 1, per_page: 100 }),
        roleService.listRoles(),
        applicationService.listApplications(),
      ]);
      setUsers(usersData.users);
      setRoles(rolesData);
      setApps(appsData);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load administration data'));
    } finally {
      setLoading(false);
    }
  };

  const reloadApps = async () => {
    try {
      setApps(await applicationService.listApplications());
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'roles' && rolesSubTab === 'audit_log' && auditLogs === null) {
      auditService
        .listLogs({ page: 1, per_page: 25 })
        .then((res) => setAuditLogs(res.logs))
        .catch((err) => {
          setAuditLogs([]);
          showToast(errorMessage(err), true);
        });
    }
  }, [activeTab, rolesSubTab, auditLogs]);

  // ── Employees ──

  const openCreateUserModal = () => {
    setUserForm({ ...emptyUserForm });
    setIsAddUserOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // No password is sent: the server generates a one-time password.
      const created = await userService.createUser({
        email: userForm.email,
        first_name: userForm.firstName,
        last_name: userForm.lastName,
        department: userForm.department || undefined,
        designation: userForm.designation || undefined,
        phone: userForm.phone || undefined,
      });
      setIsAddUserOpen(false);
      if (created.temporary_password) {
        setOneTimePassword({ user: created, password: created.temporary_password, reason: 'created' });
        setOpenAccessAfterPassword(created);
      } else {
        openAccessEditor(created);
      }
      loadData();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to create employee'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (u: User) => {
    if (
      !window.confirm(
        `Issue a new one-time password for ${u.first_name} ${u.last_name}?\n\n` +
          'Their current password stops working, all their sessions are signed out, and they must choose a new password at next sign-in.'
      )
    ) {
      return;
    }
    try {
      const res = await userService.resetPassword(u.id);
      if (res.temporary_password) {
        setOneTimePassword({ user: u, password: res.temporary_password, reason: 'reset' });
      }
      loadData();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to reset password'), true);
    }
  };

  const closeOneTimePassword = () => {
    setOneTimePassword(null);
    if (openAccessAfterPassword) {
      openAccessEditor(openAccessAfterPassword);
      setOpenAccessAfterPassword(null);
    }
  };

  const handleToggleActive = async (u: User) => {
    if (
      u.is_active &&
      !window.confirm(
        `Deactivate ${u.first_name} ${u.last_name}?\n\n` +
          'They are signed out immediately and revocation of every application role they hold is started. ' +
          'Revocations show as pending until each application confirms them.'
      )
    ) {
      return;
    }
    try {
      const updated = await userService.updateUser(u.id, { is_active: !u.is_active });
      showToast(updated.is_active ? 'Employee reactivated' : 'Employee deactivated; access revocation started');
      if (accessUser?.id === u.id) {
        setAccessUser(updated);
        await loadAccess(updated.id);
      }
      loadData();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  // ── Employee access editor ──

  const loadAccess = async (userId: string) => {
    setAccessLoading(true);
    try {
      const current = await assignmentService.getUserAssignments(userId);
      setAccessAssignments(current);
      const selected: Record<string, boolean> = {};
      for (const a of current) {
        if (a.status === 'active' && a.app_role_id) selected[roleKey(a.application_id, a.app_role_id)] = true;
      }
      setSelectedRoles(selected);
      setExpiryByApp({});
      setPlannedChanges(null);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load application access'), true);
    } finally {
      setAccessLoading(false);
    }
  };

  const openAccessEditor = (u: User) => {
    setAccessUser(u);
    setProfileForm({
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      department: u.department || '',
      designation: u.designation || '',
      phone: u.phone || '',
    });
    setEntraForm({ objectId: '', tenantId: '' });
    loadAccess(u.id);
  };

  const closeAccessEditor = () => {
    setAccessUser(null);
    setAccessAssignments([]);
    setPlannedChanges(null);
  };

  const activeAssignments = accessAssignments.filter((a) => a.status === 'active');
  const currentKeys = useMemo(
    () =>
      new Map(
        activeAssignments
          .filter((a) => a.app_role_id)
          .map((a) => [roleKey(a.application_id, a.app_role_id as string), a] as const)
      ),
    [accessAssignments]
  );

  const pendingGrants: GrantItem[] = [];
  for (const app of apps) {
    for (const role of app.roles) {
      const key = roleKey(app.id, role.id);
      if (selectedRoles[key] && !currentKeys.has(key)) {
        const expiry = expiryByApp[app.id];
        pendingGrants.push({
          application_id: app.id,
          app_role_id: role.id,
          expires_at: expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null,
        });
      }
    }
  }
  const pendingRevokes = [...currentKeys.entries()]
    .filter(([key]) => !selectedRoles[key])
    .map(([, a]) => a.id);
  const hasPendingChanges = pendingGrants.length > 0 || pendingRevokes.length > 0;

  const toggleRole = (appId: string, roleId: string, checked: boolean) => {
    setSelectedRoles({ ...selectedRoles, [roleKey(appId, roleId)]: checked });
    setPlannedChanges(null);
  };

  const handleReviewChanges = async () => {
    if (!accessUser) return;
    setBusy(true);
    try {
      const res = await assignmentService.changeAccess(accessUser.id, {
        grants: pendingGrants,
        revokes: pendingRevokes,
        dry_run: true,
      });
      setPlannedChanges(res.changes);
    } catch (err) {
      setPlannedChanges(null);
      showToast(errorMessage(err, 'The requested changes are not valid'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmChanges = async () => {
    if (!accessUser) return;
    setBusy(true);
    try {
      const res = await assignmentService.changeAccess(accessUser.id, {
        grants: pendingGrants,
        revokes: pendingRevokes,
        dry_run: false,
      });
      showToast(
        `${res.changes.length} change(s) submitted. Each shows as pending until the application confirms it.`
      );
      await loadAccess(accessUser.id);
      loadData();
    } catch (err) {
      showToast(errorMessage(err, 'Changes were not applied'), true);
    } finally {
      setBusy(false);
    }
  };

  const runAssignmentAction = async (action: () => Promise<unknown>, done: string) => {
    if (!accessUser) return;
    try {
      await action();
      showToast(done);
      await loadAccess(accessUser.id);
      loadData();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  const handleRevoke = (a: Assignment) => {
    if (!window.confirm(`Revoke "${a.app_role}" in ${a.application_name}?`)) return;
    runAssignmentAction(() => assignmentService.revokeAssignment(a.id), 'Revocation started; pending confirmation from the application');
  };

  const handleRetry = (a: Assignment) =>
    runAssignmentAction(() => assignmentService.retry(a.id), 'Provisioning retry queued');

  const handleConfirmManual = (a: Assignment) => {
    const verb = a.status === 'active' ? 'granted' : 'removed';
    const note = window.prompt(
      `Confirm that "${a.app_role}" has been ${verb} in ${a.application_name} for ${accessUser?.first_name}.\n\n` +
        'This records your attestation in the audit trail. Optional note:'
    );
    if (note === null) return;
    runAssignmentAction(() => assignmentService.confirmManual(a.id, note || undefined), 'Change confirmed');
  };

  const handleSaveProfile = async () => {
    if (!accessUser) return;
    setBusy(true);
    try {
      const updated = await userService.updateUser(accessUser.id, {
        first_name: profileForm.firstName,
        last_name: profileForm.lastName,
        department: profileForm.department,
        designation: profileForm.designation,
        phone: profileForm.phone,
      });
      setAccessUser(updated);
      showToast('Profile saved');
      loadData();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to save profile'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleLinkEntra = async () => {
    if (!accessUser) return;
    try {
      const updated = await userService.linkEntra(accessUser.id, entraForm.objectId.trim(), entraForm.tenantId.trim());
      setAccessUser(updated);
      setEntraForm({ objectId: '', tenantId: '' });
      showToast('Entra account linked');
      loadData();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  const handleUnlinkEntra = async () => {
    if (!accessUser || !window.confirm('Remove the Entra link? Their Microsoft sign-in will stop working.')) return;
    try {
      setAccessUser(await userService.unlinkEntra(accessUser.id));
      showToast('Entra link removed');
      loadData();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  // ── Applications ──

  const handleRegisterApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleNames = newAppForm.rolesString
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const integration = newAppForm.integrationType;
    const connectorConfig =
      integration === 'entra_app_roles'
        ? { service_principal_id: newAppForm.servicePrincipalId.trim() }
        : integration === 'scim' || integration === 'custom_api'
          ? { base_url: newAppForm.baseUrl.trim() }
          : null;

    setBusy(true);
    try {
      await applicationService.createApplication({
        name: newAppForm.name.trim(),
        slug: newAppForm.slug.trim(),
        category: newAppForm.category,
        description: newAppForm.description || undefined,
        color: newAppForm.themeColor,
        url: newAppForm.url.trim() || null,
        requires_license: newAppForm.requiresLicense,
        integration_type: integration,
        connector_config: connectorConfig,
        connector_secret_ref: integration === 'manual' ? null : newAppForm.secretRef.trim() || null,
        roles: roleNames.map((name, i) => ({ name, sort_order: i })),
      });
      showToast(`Application "${newAppForm.name}" registered`);
      setIsRegisterAppOpen(false);
      setNewAppForm({ ...emptyNewApp });
      reloadApps();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to register application'), true);
    } finally {
      setBusy(false);
    }
  };

  const openManageRoles = (appId: string) => {
    setManagingRolesAppId(appId);
    setConnectorResult(null);
    setNewRoleInput('');
    setNewRoleExternalId('');
  };

  const handleAddRoleToApp = async () => {
    if (!managingRolesApp || !newRoleInput.trim()) return;
    try {
      await applicationService.createRole(managingRolesApp.id, {
        name: newRoleInput.trim(),
        external_role_id: newRoleExternalId.trim() || null,
      });
      setNewRoleInput('');
      setNewRoleExternalId('');
      showToast(`Role added to ${managingRolesApp.name}`);
      reloadApps();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  const handleDeleteRole = async (roleId: string, name: string) => {
    if (!managingRolesApp || !window.confirm(`Remove "${name}" from the ${managingRolesApp.name} role catalogue?`)) return;
    try {
      await applicationService.deleteRole(managingRolesApp.id, roleId);
      showToast(`Role "${name}" removed`);
      reloadApps();
    } catch (err) {
      // 409 when employees still hold the role
      showToast(errorMessage(err), true);
    }
  };

  const handleTestConnection = async () => {
    if (!managingRolesApp) return;
    setBusy(true);
    try {
      const res = await applicationService.testConnection(managingRolesApp.id);
      setConnectorResult({ ok: res.ok, message: res.message });
      reloadApps();
    } catch (err) {
      setConnectorResult({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncRoles = async () => {
    if (!managingRolesApp) return;
    setBusy(true);
    try {
      const res = await applicationService.syncRoles(managingRolesApp.id);
      setConnectorResult({
        ok: true,
        message:
          `Roles read from ${managingRolesApp.name}: ${res.added.length} added, ${res.updated.length} matched` +
          (res.missing.length ? `, ${res.missing.length} no longer defined in the app (${res.missing.join(', ')})` : ''),
      });
      reloadApps();
    } catch (err) {
      setConnectorResult({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAllManual = async () => {
    if (!managingRolesApp) return;
    if (
      !window.confirm(
        `Confirm every pending change for ${managingRolesApp.name}?\n\n` +
          `By confirming, you attest that the ${managingRolesApp.name} owner has applied each pending grant and ` +
          'revocation in the application itself. This is recorded in the audit trail.'
      )
    ) {
      return;
    }
    try {
      const res = await applicationService.confirmManualChanges(managingRolesApp.id);
      showToast(`${res.confirmed} pending change(s) confirmed`);
      reloadApps();
      loadData();
    } catch (err) {
      showToast(errorMessage(err), true);
    }
  };

  // ── Derived data ──

  const departmentsList = useMemo(() => {
    const depts = Array.from(new Set(users.map((u) => u.department).filter(Boolean) as string[])).sort();
    return [{ id: 'ALL', label: 'All Departments' }, ...depts.map((d) => ({ id: d, label: d }))];
  }, [users]);

  // Helper for department badge styling
  const getDeptClass = (dept?: string | null) => {
    if (!dept) return 'dept-other';
    const d = dept.toLowerCase();
    if (d.includes('sale')) return 'dept-sales';
    if (d.includes('eng')) return 'dept-eng';
    if (d.includes('lead') || d.includes('exec') || d.includes('board')) return 'dept-lead';
    if (d.includes('tech')) return 'dept-tech';
    if (d.includes('it') || d.includes('gov')) return 'dept-it';
    return 'dept-other';
  };

  // Helper for application badge color class
  const getAppBadgeClass = (slug: string) => {
    if (slug === 'in2crm' || slug === 'crm') return 'crm';
    if (slug === 'project-mgmt' || slug === 'in2projects') return 'proj';
    if (slug === 'hr-management' || slug === 'in2hrm') return 'hrm';
    if (slug === 'leave-mgmt' || slug === 'in2leave') return 'leave';
    if (slug === 'finance' || slug === 'in2finance') return 'fin';
    return 'admin';
  };

  const filteredUsers = users.filter((u) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      !term ||
      u.first_name.toLowerCase().includes(term) ||
      u.last_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.designation && u.designation.toLowerCase().includes(term)) ||
      (u.department && u.department.toLowerCase().includes(term));

    const matchesDept =
      selectedDepartment === 'ALL' ||
      (u.department && u.department.toLowerCase() === selectedDepartment.toLowerCase());

    return matchesSearch && matchesDept;
  });

  const getDeptCount = (deptId: string) => {
    if (deptId === 'ALL') return users.length;
    return users.filter((u) => u.department && u.department.toLowerCase() === deptId.toLowerCase()).length;
  };

  const allPermissions = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; module: string }>();
    roles.forEach((r) => r.permissions?.forEach((p) => byCode.set(p.code, p)));
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [roles]);

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const renderAccessPills = (u: User) => {
    const assignments = u.app_assignments || [];
    if (assignments.length === 0) {
      return (
        <span className="odoo-app-badge">
          {u.is_superadmin ? 'Superadmin (ERP administration)' : 'No application roles'}
        </span>
      );
    }
    return assignments.map((asgn, i) => (
      <span
        key={`${asgn.application_slug}-${asgn.app_role}-${i}`}
        className={`odoo-app-badge ${getAppBadgeClass(asgn.application_slug)}`}
        title={`Role: ${asgn.app_role} — ${PROVISIONING_LABELS[(asgn.provisioning_status || 'pending') as ProvisioningStatus]?.label ?? asgn.provisioning_status}`}
      >
        <strong>{asgn.application_name}:</strong> {asgn.app_role}
        {asgn.provisioning_status && asgn.provisioning_status !== 'verified' && ' ⏳'}
      </span>
    ));
  };

  const statusPill = (u: User) =>
    u.is_active ? (
      <span className="status-active-pill">Active</span>
    ) : (
      <span className="prov-badge muted">Deactivated</span>
    );

  return (
    <div className="master-settings-layout">
      {/* ─────────────────────────────────────────────────────────────
          1. LEFT SIDEBAR (Dark Navy #121E3B - In2ERP Admin Console)
      ───────────────────────────────────────────────────────────── */}
      <aside className="master-sidebar">
        <div className="master-sidebar-brand">
          <div
            className="brand-pill-container"
            onClick={() => navigate('/')}
            title="Click to return to Launchpad"
          >
            <In2ITMark size={28} color="#121E3B" />
            <div className="brand-text">
              <span className="brand-name">In2IT EBS</span>
              <span className="brand-sub">CONVERGED INTELLIGENCE</span>
            </div>
          </div>
        </div>

        <div className="active-app-banner">
          <div className="app-banner-title">In2ERP</div>
          <div className="app-banner-sub">Enterprise Administration & Governance</div>
        </div>

        <nav className="master-nav-tree">
          <div className="nav-group">
            <div className="nav-group-header">CONFIGURE & GOVERNANCE</div>
            <div
              className={`nav-tree-item ${activeTab === 'users' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              <span>Users & Access</span>
              <span className="sidebar-count-badge">{filteredUsers.length}</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'roles' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <Shield size={16} />
              <span>Roles & Permissions</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'applications' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('applications')}
            >
              <Layers size={16} />
              <span>Applications & Registry</span>
              <span className="sidebar-count-badge">{apps.length}</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'master_lists' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('master_lists')}
            >
              <Sliders size={16} />
              <span>Master Lists</span>
            </div>
          </div>

          <div className="nav-group">
            <div className="nav-group-header">INTELLIGENCE & AUTOMATION (PLANNED)</div>
            <div
              className={`nav-tree-item ${activeTab === 'ai_assistant' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('ai_assistant')}
            >
              <Sparkles size={16} color={activeTab === 'ai_assistant' ? '#FFFFFF' : '#EC4899'} />
              <span>AI Assistant & Copilot</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'email_templates' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('email_templates')}
            >
              <Mail size={16} />
              <span>Email Templates</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'notifications' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={16} />
              <span>Notifications</span>
            </div>
          </div>
        </nav>

        <div className="master-sidebar-footer">
          <button className="btn-back-launchpad" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
            <span>Back to Launchpad</span>
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN CONTENT AREA
      ───────────────────────────────────────────────────────────── */}
      <div className="master-main-wrapper">
        <header className="master-top-header">
          <div className="header-left-title">
            <div className="title-dots-icon">⠸⠇</div>
            <h1>Master Data & Settings</h1>
          </div>

          <div className="header-right-tools">
            <div className="header-search-bar">
              <Search size={15} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search Ctrl K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              className="header-icon-badge"
              onClick={() => setActiveTab('ai_assistant')}
              title="AI Assistant (planned)"
            >
              <Bot size={18} color="#0284C7" />
            </button>

            <button
              className="header-icon-badge"
              onClick={() => setActiveTab('notifications')}
              title="Notifications (planned)"
            >
              <Bell size={18} color="#64748B" />
            </button>

            <div className="header-admin-avatar" title={user?.email || 'Administrator'}>
              <span>{user ? `${user.first_name[0] || 'S'}${user.last_name[0] || 'A'}` : 'SA'}</span>
            </div>
          </div>
        </header>

        <div className="master-category-tabs-bar">
          {(
            [
              ['users', 'Users & access'],
              ['roles', 'Roles & permissions'],
              ['applications', 'Applications & Registry'],
              ['master_lists', 'Master lists'],
              ['ai_assistant', 'AI assistant'],
              ['email_templates', 'Email templates'],
              ['notifications', 'Notifications'],
            ] as [MainTab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              className={`category-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="master-tab-content-area">
          {loadError && (
            <div className="planned-banner" style={{ borderColor: '#FCA5A5', background: '#FEF2F2', color: '#991B1B' }}>
              <AlertTriangle size={16} />
              <div>
                {loadError}{' '}
                <button className="table-action-btn" onClick={() => { setLoading(true); loadData(); }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 1: Users & access
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="settings-card-panel">
              <div className="odoo-toolbar-bar">
                <div className="odoo-dept-filters">
                  {departmentsList.map((dept) => (
                    <button
                      key={dept.id}
                      className={`odoo-dept-pill ${selectedDepartment === dept.id ? 'active' : ''}`}
                      onClick={() => setSelectedDepartment(dept.id)}
                    >
                      <span>{dept.label}</span>
                      <span className="odoo-dept-count">{getDeptCount(dept.id)}</span>
                    </button>
                  ))}
                </div>

                <div className="odoo-toolbar-right">
                  <div className="odoo-search-input">
                    <Search size={14} color="#64748B" />
                    <input
                      type="text"
                      placeholder="Search employees, roles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="odoo-view-switcher">
                    <button
                      className={`odoo-view-btn ${employeeViewMode === 'kanban' ? 'active' : ''}`}
                      onClick={() => setEmployeeViewMode('kanban')}
                      title="Kanban Cards View"
                    >
                      <LayoutGrid size={15} />
                      <span>Kanban</span>
                    </button>
                    <button
                      className={`odoo-view-btn ${employeeViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setEmployeeViewMode('list')}
                      title="List Table View"
                    >
                      <List size={15} />
                      <span>List</span>
                    </button>
                  </div>

                  <button className="btn-plum-action" onClick={openCreateUserModal}>
                    <Plus size={16} />
                    <span>Add Employee</span>
                  </button>
                </div>
              </div>

              {loading && <div className="console-muted-note" style={{ padding: 20 }}>Loading employees…</div>}

              {!loading && employeeViewMode === 'kanban' && (
                <div className="odoo-kanban-container">
                  {filteredUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                      <Users size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1E293B' }}>
                        No employees match the selected criteria
                      </div>
                      <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                        Try selecting "All Departments" or clearing your search query.
                      </div>
                    </div>
                  ) : (
                    <div className="odoo-kanban-grid">
                      {filteredUsers.map((u) => {
                        const initials = `${u.first_name?.[0] || 'E'}${u.last_name?.[0] || 'M'}`.toUpperCase();
                        return (
                          <div key={u.id} className="odoo-employee-card">
                            <div>
                              <div className="odoo-card-top">
                                <div className="odoo-avatar-circle">{initials}</div>
                                <div className="odoo-card-identity">
                                  <h3 className="odoo-card-name">
                                    {u.first_name} {u.last_name}
                                  </h3>
                                  <div className="odoo-card-designation">{u.designation || '—'}</div>
                                  <span className={`odoo-badge-dept ${getDeptClass(u.department)}`}>
                                    {u.department || 'No department'}
                                  </span>
                                </div>
                              </div>

                              <div className="odoo-card-contact-box">
                                <div className="odoo-contact-row" title={u.email}>
                                  <Mail size={13} color="#64748B" />
                                  <span>{u.email}</span>
                                </div>
                                <div className="odoo-contact-row">
                                  <Phone size={13} color="#64748B" />
                                  <span>{u.phone || '—'}</span>
                                </div>
                              </div>

                              <div className="odoo-app-access-preview">
                                <div className="odoo-app-access-label">
                                  Application Roles ({(u.app_assignments || []).length})
                                </div>
                                <div className="odoo-app-pills-row">{renderAccessPills(u)}</div>
                              </div>
                            </div>

                            <div className="odoo-card-footer">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {statusPill(u)}
                                {u.entra_linked && <span className="prov-badge ok" title="Linked to Microsoft Entra">Entra</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn-odoo-icon-action"
                                  onClick={() => handleResetPassword(u)}
                                  title="Issue a one-time password"
                                >
                                  <RotateCcw size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-odoo-edit-access"
                                  onClick={() => openAccessEditor(u)}
                                  title="Manage profile and application roles"
                                >
                                  <ShieldCheck size={14} color="#6B2144" />
                                  <span>Access Rights</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!loading && employeeViewMode === 'list' && (
                <div className="master-data-table-wrapper">
                  <table className="master-data-table">
                    <thead>
                      <tr>
                        <th>EMPLOYEE</th>
                        <th>JOB POSITION & DEPT</th>
                        <th>ERP ROLES</th>
                        <th>APPLICATION ROLES</th>
                        <th>STATUS</th>
                        <th>LAST SIGN-IN</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const initials = `${u.first_name?.[0] || 'E'}${u.last_name?.[0] || 'M'}`.toUpperCase();
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="odoo-user-row-identity">
                                <div className="odoo-table-avatar">{initials}</div>
                                <div>
                                  <div className="cell-name-bold">
                                    {u.first_name} {u.last_name}
                                  </div>
                                  <div className="cell-muted-sm">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.8rem' }}>
                                {u.designation || '—'}
                              </div>
                              <span className={`odoo-badge-dept ${getDeptClass(u.department)}`} style={{ marginTop: 3 }}>
                                {u.department || 'No department'}
                              </span>
                            </td>
                            <td>
                              {(u.role_names || []).map((r) => (
                                <span key={r} className="role-lavender-badge" style={{ marginRight: 4 }}>
                                  {r}
                                </span>
                              ))}
                            </td>
                            <td>
                              <div className="odoo-app-pills-row">{renderAccessPills(u)}</div>
                            </td>
                            <td>{statusPill(u)}</td>
                            <td className="cell-muted">{u.last_login_at ? formatDate(u.last_login_at) : 'Never'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-group">
                                <button
                                  className="table-action-btn"
                                  onClick={() => openAccessEditor(u)}
                                  title="Manage profile and application roles"
                                >
                                  <ShieldCheck size={14} color="#6B2144" />
                                  <span>Access Rights</span>
                                </button>
                                <button
                                  className="table-action-btn"
                                  onClick={() => handleResetPassword(u)}
                                  title="Issue a one-time password"
                                >
                                  <RotateCcw size={14} />
                                  <span>Reset Pass</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 2: Roles & permissions (ERP platform roles only)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'roles' && (
            <div className="settings-card-panel">
              <div className="roles-subtabs-pill-row">
                {(
                  [
                    ['roles_list', 'Roles', <Shield size={14} key="i" />],
                    ['role_matrix', 'Role Matrix', <Grid size={14} key="i" />],
                    ['permission_sets', 'Permission Sets', <Layers size={14} key="i" />],
                    ['user_assignment', 'User Assignment', <UserCheck size={14} key="i" />],
                    ['data_scopes', 'Data Scopes', <ShieldCheck size={14} key="i" />],
                    ['approval_permissions', 'Approval Permissions', <CheckCircle2 size={14} key="i" />],
                    ['permissions', 'Permissions', <Lock size={14} key="i" />],
                    ['audit_log', 'Audit Log', <History size={14} key="i" />],
                  ] as [RolesSubTab, string, React.ReactNode][]
                ).map(([tab, label, icon]) => (
                  <button
                    key={tab}
                    className={`subtab-pill-btn ${rolesSubTab === tab ? 'active' : ''}`}
                    onClick={() => setRolesSubTab(tab)}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="app-registry-info-banner" style={{ marginBottom: 14 }}>
                <Shield size={18} color="#6B2144" />
                <div>
                  These are <strong>ERP platform roles</strong> for administering In2ERP itself. Roles inside each
                  application (e.g. In2CRM “Sales Manager”) live in that application's role catalogue under
                  Applications & Registry. Edit ERP roles on the <Link to="/roles">Roles & RBAC</Link> page.
                </div>
              </div>

              {rolesSubTab === 'roles_list' && (
                <div>
                  <div className="panel-top-action-bar">
                    <div className="panel-count-label">Roles • {roles.length}</div>
                    <button className="btn-plum-action" onClick={() => navigate('/roles')}>
                      <Plus size={16} />
                      <span>Manage roles</span>
                    </button>
                  </div>

                  <div className="master-data-table-wrapper">
                    <table className="master-data-table">
                      <thead>
                        <tr>
                          <th>ROLE</th>
                          <th>DESCRIPTION</th>
                          <th>PERMISSIONS</th>
                          <th>USERS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span className="role-lavender-badge">{r.name}</span>
                              {r.is_system && <span className="system-tag-sub">system</span>}
                            </td>
                            <td className="cell-desc-text">{r.description || '—'}</td>
                            <td>
                              {allPermissions.length > 0 && r.permissions?.length === allPermissions.length ? (
                                <span className="grants-all-badge">ALL (*)</span>
                              ) : (
                                <span className="cell-muted">{r.permissions?.length ?? 0}</span>
                              )}
                            </td>
                            <td className="cell-muted">{r.user_count ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rolesSubTab === 'role_matrix' && (
                <div>
                  <div className="matrix-toolbar-header">
                    <div className="matrix-header-info">
                      <span className="matrix-title">Role Matrix</span>
                      <span className="matrix-subtitle">
                        • {allPermissions.length} permissions × {roles.length} roles
                      </span>
                    </div>
                    <div className="matrix-legend-row">
                      <span className="legend-item">
                        <span className="legend-dot green" /> Granted
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot red" /> Not granted
                      </span>
                    </div>
                  </div>

                  <div className="master-data-table-wrapper">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>PERMISSION</th>
                          {roles.map((r) => (
                            <th key={r.id}>{r.name.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allPermissions.map((p) => (
                          <tr key={p.code}>
                            <td>
                              <div className="perm-cell-content">
                                <span className="perm-badge-pill">{p.module}</span>
                                <div>
                                  <div className="perm-label">{p.name}</div>
                                  <div className="perm-code">{p.code}</div>
                                </div>
                              </div>
                            </td>
                            {roles.map((r) => (
                              <td key={r.id} className="matrix-cell">
                                {r.permissions?.some((rp) => rp.code === p.code) ? (
                                  <span className="icon-allow">✓</span>
                                ) : (
                                  <span className="icon-deny">✕</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rolesSubTab === 'permissions' && (
                <div className="master-data-table-wrapper">
                  <table className="master-data-table">
                    <thead>
                      <tr>
                        <th>CODE</th>
                        <th>NAME</th>
                        <th>MODULE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPermissions.map((p) => (
                        <tr key={p.code}>
                          <td className="cell-code-mono">{p.code}</td>
                          <td>{p.name}</td>
                          <td className="cell-muted">{p.module}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(rolesSubTab === 'permission_sets' || rolesSubTab === 'approval_permissions') && (
                <PlannedBanner
                  what={rolesSubTab === 'permission_sets' ? 'Permission sets' : 'Approval permissions'}
                />
              )}

              {rolesSubTab === 'user_assignment' && (
                <div>
                  <div className="panel-top-action-bar">
                    <div className="panel-count-label">
                      <strong>User Access</strong> • ERP roles and application roles
                    </div>
                  </div>

                  <div className="master-data-table-wrapper">
                    <table className="master-data-table">
                      <thead>
                        <tr>
                          <th>USER</th>
                          <th>ERP ROLES</th>
                          <th>APPLICATION ROLES</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <div className="cell-name-bold">
                                {u.first_name} {u.last_name}
                              </div>
                              <div className="cell-muted-sm">{u.email}</div>
                            </td>
                            <td>
                              {(u.role_names || []).map((r) => (
                                <span key={r} className="role-lavender-badge" style={{ marginRight: 4 }}>
                                  {r}
                                </span>
                              ))}
                            </td>
                            <td className="cell-muted">{(u.app_assignments || []).length}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="table-action-btn" onClick={() => openAccessEditor(u)}>
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rolesSubTab === 'data_scopes' && (
                <div>
                  <PlannedBanner what="Row-level data scopes (e.g. In2CRM own/team/practice/all)" />
                  <div className="data-scopes-alert-box">
                    <Shield size={18} color="#0284C7" />
                    <div>
                      Data scopes belong to each application's own authorization model and must be enforced by
                      that application. They will be configurable here once an application exposes them through
                      its connector.
                    </div>
                  </div>
                </div>
              )}

              {rolesSubTab === 'audit_log' && (
                <div className="audit-subtab-view">
                  <div className="panel-count-label">
                    Security Audit Trail • latest 25 entries{' '}
                    <Link to="/audit" style={{ marginLeft: 8 }}>
                      Open full audit log
                    </Link>
                  </div>
                  <div className="audit-timeline-feed">
                    {auditLogs === null && <div className="console-muted-note">Loading…</div>}
                    {auditLogs?.length === 0 && <div className="console-muted-note">No audit entries.</div>}
                    {auditLogs?.map((log) => (
                      <div key={log.id} className="audit-item">
                        <div className="audit-dot" />
                        <div>
                          <strong>{log.action}</strong> on <code>{log.resource_type}</code>
                          {log.status === 'failure' && <span className="prov-badge bad" style={{ marginLeft: 6 }}>failure</span>}
                          <div className="audit-time">
                            {new Date(log.timestamp).toLocaleString('en-GB')} • {log.user_email || 'system'}
                            {log.ip_address ? ` • ${log.ip_address}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 3: Applications & Registry
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'applications' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>{apps.length} Registered Applications</strong> • Registry & role catalogues
                </div>
                <button className="btn-plum-action" onClick={() => setIsRegisterAppOpen(true)}>
                  <Plus size={16} />
                  <span>Register Application</span>
                </button>
              </div>

              <div className="app-registry-info-banner">
                <Layers size={18} color="#6B2144" />
                <div>
                  <strong>How access works:</strong> In2ERP records which roles each employee should hold and
                  delivers changes through each application's connector. An application with a <em>manual</em>{' '}
                  integration needs its owner to apply each change and confirm it here. Every application must also
                  enforce its roles itself; hiding a tile is not access control.
                </div>
              </div>

              {!loading && apps.length === 0 && (
                <div className="console-muted-note" style={{ padding: 20 }}>No applications registered yet.</div>
              )}

              <div className="apps-registry-grid">
                {apps.map((appItem) => (
                  <div key={appItem.id} className="app-registry-card">
                    <div className="app-card-top-row">
                      <div className="app-card-badge-icon" style={{ background: appItem.color || '#6B2144' }}>
                        <Layers size={22} color="#FFFFFF" />
                      </div>
                      <div className="app-card-title-group">
                        <div className="app-card-title">{appItem.name}</div>
                        <div className="app-card-slug">/{appItem.slug}</div>
                      </div>
                      <span className="app-category-badge">{appItem.category || 'Uncategorised'}</span>
                    </div>

                    <p className="app-card-description">{appItem.description || '—'}</p>

                    <div className="console-muted-note" style={{ marginBottom: 8 }}>
                      <Plug size={12} style={{ verticalAlign: -2 }} /> {INTEGRATION_LABELS[appItem.integration_type]}{' '}
                      •{' '}
                      <span
                        className={`prov-badge ${
                          appItem.integration_status === 'healthy'
                            ? 'ok'
                            : appItem.integration_status === 'error'
                              ? 'bad'
                              : appItem.integration_status === 'manual'
                                ? 'muted'
                                : 'warn'
                        }`}
                      >
                        {appItem.integration_status}
                      </span>
                      <br />
                      Launch URL: {appItem.url || <em>not set</em>} • {appItem.assigned_users ?? 0} user(s)
                    </div>

                    <div className="app-card-roles-section">
                      <div className="roles-header-row">
                        <span className="roles-title-label">Role catalogue ({appItem.roles.length}):</span>
                        <button className="btn-manage-app-roles" onClick={() => openManageRoles(appItem.id)}>
                          <PlusCircle size={12} />
                          <span>Manage</span>
                        </button>
                      </div>

                      <div className="app-roles-tag-list">
                        {appItem.roles.length === 0 && <span className="console-muted-note">No roles defined</span>}
                        {appItem.roles.map((r) => (
                          <span
                            key={r.id}
                            className="app-role-tag"
                            title={`Source: ${r.source} • Sync: ${r.sync_status}${r.external_role_id ? ` • External ID: ${r.external_role_id}` : ''}`}
                            style={r.sync_status === 'missing' ? { textDecoration: 'line-through' } : undefined}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="app-card-footer-info">
                      <div className="license-indicator">
                        {appItem.requires_license ? (
                          <span className="license-tag enterprise">Licensed</span>
                        ) : (
                          <span className="license-tag core">Core Included</span>
                        )}
                      </div>
                      <div className="status-indicator">
                        {appItem.is_active ? (
                          <span className="status-active-pill">● Active</span>
                        ) : (
                          <span className="prov-badge muted">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 4: Master lists
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'master_lists' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">Master Lists & Enterprise Taxonomies</div>
              </div>

              <div className="master-lists-grid">
                <div className="master-list-card">
                  <div className="master-list-header">
                    <Building size={18} color="#6B2144" />
                    <h4>Departments in use ({departmentsList.length - 1})</h4>
                  </div>
                  <div className="master-items-list">
                    {departmentsList.slice(1).map((d) => (
                      <div key={d.id} className="master-item-row">
                        <span>{d.label}</span>
                        <span className="cell-muted">{getDeptCount(d.id)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="master-list-card">
                  <div className="master-list-header">
                    <Grid size={18} color="#2563EB" />
                    <h4>Branches & Entities</h4>
                  </div>
                  <PlannedBanner what="Branch and entity management" />
                </div>

                <div className="master-list-card">
                  <div className="master-list-header">
                    <DollarSign size={18} color="#059669" />
                    <h4>Currencies & Fiscal</h4>
                  </div>
                  <PlannedBanner what="Currency and fiscal settings" />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 5: AI assistant (planned)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai_assistant' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>AI Assistant & Chatbot Access Governance</strong>
                </div>
              </div>
              <PlannedBanner what="The AI assistant" />

              <div className="ai-settings-container">
                <div className="ai-model-box">
                  <div className="ai-model-icon">
                    <Bot size={32} color="#FFFFFF" />
                  </div>
                  <div className="ai-model-info">
                    <h3>In2IT AI Copilot</h3>
                    <p>No AI model is connected to In2ERP. This section will configure one when it is introduced.</p>
                  </div>
                </div>

                <div className="ai-app-toggles-section">
                  <h4 className="section-title">Application-Level AI Access</h4>
                  <div className="app-toggles-grid">
                    {apps.map((appItem) => (
                      <div key={appItem.id} className="app-toggle-card">
                        <div className="toggle-card-header">
                          <div>
                            <h5>{appItem.name}</h5>
                            <span className="app-toggle-desc">{appItem.description}</span>
                          </div>
                          <label className="switch-toggle" title={NOT_AVAILABLE}>
                            <input type="checkbox" checked={false} disabled readOnly />
                            <span className="slider-round" />
                          </label>
                        </div>
                        <div className="toggle-card-status">
                          <span className="status-badge-grey">○ Not available</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ai-sandbox-section">
                  <h4 className="section-title">Test AI Application Assistant</h4>
                  <div className="ai-prompt-box">
                    <div className="prompt-input-row">
                      <input
                        type="text"
                        placeholder="Not available: no AI model is connected"
                        value={aiTestPrompt}
                        onChange={(e) => setAiTestPrompt(e.target.value)}
                        disabled
                      />
                      <button className="btn-plum-action" disabled title={NOT_AVAILABLE}>
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 6: Email templates (planned)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'email_templates' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>System Email Templates</strong> • Employee Provisioning & Alerts
                </div>
              </div>
              <PlannedBanner what="Email sending" />

              <div className="email-templates-layout">
                <div className="template-selector-list">
                  {(
                    [
                      ['welcome', 'Employee Onboarding', 'Access & Application Grant', <Mail size={16} key="i" />],
                      ['role_change', 'Application Roles Changed', 'Application Scope Alert', <ShieldCheck size={16} key="i" />],
                      ['password_reset', 'Password Reset', 'Credentials', <Key size={16} key="i" />],
                    ] as [string, string, string, React.ReactNode][]
                  ).map(([key, name, sub, icon]) => (
                    <div
                      key={key}
                      className={`template-selector-item ${selectedTemplateKey === key ? 'active' : ''}`}
                      onClick={() => setSelectedTemplateKey(key)}
                    >
                      {icon}
                      <div>
                        <div className="template-item-name">{name}</div>
                        <div className="template-item-sub">{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="template-preview-panel">
                  {(() => {
                    const key = selectedTemplateKey as keyof typeof emailTemplates;
                    const currentTpl = emailTemplates[key];
                    return (
                      <div>
                        <div className="template-preview-header">
                          <h4>{currentTpl.title}</h4>
                          <span className="template-variable-hint">
                            Variables: <code>{'{{employee_name}}'}</code>, <code>{'{{assigned_apps_list}}'}</code>,{' '}
                            <code>{'{{login_url}}'}</code>
                          </span>
                        </div>

                        <div className="template-field-group">
                          <label>Email Subject:</label>
                          <input
                            type="text"
                            value={currentTpl.subject}
                            onChange={(e) =>
                              setEmailTemplates({ ...emailTemplates, [key]: { ...currentTpl, subject: e.target.value } })
                            }
                          />
                        </div>

                        <div className="template-field-group">
                          <label>Message Content:</label>
                          <textarea
                            rows={10}
                            value={currentTpl.body}
                            onChange={(e) =>
                              setEmailTemplates({ ...emailTemplates, [key]: { ...currentTpl, body: e.target.value } })
                            }
                          />
                        </div>

                        <div className="template-action-row">
                          <button className="btn-plum-action" disabled title={NOT_AVAILABLE}>
                            <Check size={16} />
                            <span>Save Template</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 7: Notifications (planned)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>System Broadcasts & In2ERP Notifications</strong>
                </div>
              </div>
              <PlannedBanner what="Broadcast notifications" />

              <div className="notifications-container">
                <form onSubmit={(e) => e.preventDefault()} className="broadcast-composer-card">
                  <h4 className="section-title">Dispatch System Announcement</h4>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Announcement Title</label>
                      <input
                        type="text"
                        value={broadcastForm.title}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Audience</label>
                      <select
                        value={broadcastForm.targetApp}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, targetApp: e.target.value })}
                      >
                        <option value="all">All employees</option>
                        {apps.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} users
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Broadcast Message</label>
                    <textarea
                      rows={3}
                      value={broadcastForm.message}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    />
                  </div>

                  <div className="broadcast-footer-row">
                    <button type="submit" className="btn-plum-action" disabled title={NOT_AVAILABLE}>
                      <Send size={15} />
                      <span>Dispatch Broadcast</span>
                    </button>
                  </div>
                </form>

                <div className="notifications-history-card">
                  <h4 className="section-title">Recent Broadcast History</h4>
                  <div className="console-muted-note" style={{ padding: 12 }}>
                    No broadcasts have been sent.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: ADD EMPLOYEE
      ───────────────────────────────────────────────────────────── */}
      {isAddUserOpen && (
        <div className="master-modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Employee</h2>
              <button className="modal-close-btn" onClick={() => setIsAddUserOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-body-scrollable">
              <div className="form-section-title">Employee Identity</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@in2itebs.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  />
                  <span className="field-hint">
                    Use the employee's Microsoft account email so their first Entra sign-in links to this record.
                  </span>
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    list="department-options"
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                  />
                  <datalist id="department-options">
                    {departmentsList.slice(1).map((d) => (
                      <option key={d.id} value={d.label} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <p className="field-hint">
                A one-time password is generated by the server and shown to you once. The employee must change it at
                first sign-in. After creating the employee you can review and grant application roles.
              </p>

              <div className="modal-form-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-plum-action" disabled={busy}>
                  {busy ? 'Creating…' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: EMPLOYEE PROFILE & APPLICATION ACCESS
      ───────────────────────────────────────────────────────────── */}
      {accessUser && (
        <div className="master-modal-backdrop" onClick={closeAccessEditor}>
          <div className="master-modal-card" style={{ maxWidth: 980 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {accessUser.first_name} {accessUser.last_name} — Profile & Application Access
              </h2>
              <button className="modal-close-btn" onClick={closeAccessEditor}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              {/* Profile */}
              <div className="form-section-title">1. Profile</div>
              <div className="access-section">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      list="department-options-edit"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                    />
                    <datalist id="department-options-edit">
                      {departmentsList.slice(1).map((d) => (
                        <option key={d.id} value={d.label} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input
                      type="text"
                      value={profileForm.designation}
                      onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={profileForm.email} disabled />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="access-section-actions">
                  <button className="btn-plum-action" onClick={handleSaveProfile} disabled={busy}>
                    Save profile
                  </button>
                </div>
              </div>

              {/* Account */}
              <div className="form-section-title">2. Account & Identity</div>
              <div className="access-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    Status: {statusPill(accessUser)}{' '}
                    {accessUser.must_change_password && (
                      <span className="prov-badge warn">Password change pending</span>
                    )}
                    {accessUser.locked_until && new Date(accessUser.locked_until) > new Date() && (
                      <span className="prov-badge bad">Locked</span>
                    )}
                  </div>
                  <button
                    className="table-action-btn"
                    onClick={() => handleToggleActive(accessUser)}
                    disabled={accessUser.id === user?.id}
                    title={accessUser.id === user?.id ? 'You cannot deactivate your own account' : undefined}
                  >
                    <Power size={14} />
                    <span>{accessUser.is_active ? 'Deactivate' : 'Reactivate'}</span>
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Link2 size={14} style={{ verticalAlign: -2 }} /> Microsoft Entra:{' '}
                  {accessUser.entra_linked ? (
                    <>
                      <span className="prov-badge ok">Linked</span>{' '}
                      <button className="table-action-btn" onClick={handleUnlinkEntra}>
                        Unlink
                      </button>
                    </>
                  ) : (
                    <span className="prov-badge muted">Not linked</span>
                  )}
                </div>
                {!accessUser.entra_linked && (
                  <>
                    <div className="console-muted-note" style={{ margin: '6px 0' }}>
                      Linked automatically at first Microsoft sign-in when the email matches, or link now with the
                      employee's Entra object ID and tenant ID.
                    </div>
                    <div className="inline-form-row">
                      <input
                        placeholder="Entra object ID (GUID)"
                        value={entraForm.objectId}
                        onChange={(e) => setEntraForm({ ...entraForm, objectId: e.target.value })}
                      />
                      <input
                        placeholder="Tenant ID (GUID)"
                        value={entraForm.tenantId}
                        onChange={(e) => setEntraForm({ ...entraForm, tenantId: e.target.value })}
                      />
                      <button
                        className="table-action-btn"
                        onClick={handleLinkEntra}
                        disabled={!entraForm.objectId.trim() || !entraForm.tenantId.trim()}
                      >
                        Link
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Current roles */}
              <div className="form-section-title">3. Current Application Roles</div>
              <div className="access-section">
                {accessLoading ? (
                  <div className="console-muted-note">Loading…</div>
                ) : activeAssignments.length === 0 ? (
                  <div className="console-muted-note">No application roles.</div>
                ) : (
                  <table className="odoo-access-matrix-table">
                    <thead>
                      <tr>
                        <th>APPLICATION</th>
                        <th>ROLE</th>
                        <th>PROVISIONING</th>
                        <th>EXPIRES</th>
                        <th style={{ textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAssignments.map((a) => (
                        <tr key={a.id}>
                          <td>{a.application_name}</td>
                          <td>{a.app_role}</td>
                          <td>
                            <ProvisioningBadge status={a.provisioning_status} />
                            {a.last_error && <div className="access-error-text">{a.last_error}</div>}
                          </td>
                          <td className="cell-muted">{formatDate(a.expires_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-actions-group">
                              {a.provisioning_status === 'manual_action_required' && (
                                <button className="table-action-btn" onClick={() => handleConfirmManual(a)} title="App owner applied this change">
                                  <Check size={13} />
                                  <span>Confirm applied</span>
                                </button>
                              )}
                              {(a.provisioning_status === 'failed' || a.provisioning_status === 'reconciliation_required') && (
                                <button className="table-action-btn" onClick={() => handleRetry(a)}>
                                  <RefreshCw size={13} />
                                  <span>Retry</span>
                                </button>
                              )}
                              <button className="table-action-btn" onClick={() => handleRevoke(a)}>
                                <Trash2 size={13} />
                                <span>Revoke</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {accessAssignments.some((a) => a.status !== 'active' && a.provisioning_status !== 'revoked') && (
                  <div style={{ marginTop: 12 }}>
                    <div className="console-muted-note" style={{ marginBottom: 6 }}>
                      Revocations awaiting confirmation from the application:
                    </div>
                    {accessAssignments
                      .filter((a) => a.status !== 'active' && a.provisioning_status !== 'revoked')
                      .map((a) => (
                        <div key={a.id} className="planned-change-row">
                          <span>
                            {a.application_name} / {a.app_role}
                          </span>
                          <ProvisioningBadge status={a.provisioning_status} />
                          {a.provisioning_status === 'manual_action_required' && (
                            <button className="table-action-btn" onClick={() => handleConfirmManual(a)}>
                              Confirm removed
                            </button>
                          )}
                          {(a.provisioning_status === 'failed' || a.provisioning_status === 'reconciliation_required') && (
                            <button className="table-action-btn" onClick={() => handleRetry(a)}>
                              Retry
                            </button>
                          )}
                          {a.last_error && <span className="access-error-text">{a.last_error}</span>}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Change access */}
              <div className="form-section-title">4. Change Application Roles</div>
              <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                Tick the roles this employee should hold. Changes are validated and shown for review before anything
                is applied. Unticking a current role revokes it.
              </p>
              {!accessUser.is_active && (
                <div className="planned-banner">Deactivated employees cannot be granted access.</div>
              )}
              <table className="odoo-access-matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>APPLICATION</th>
                    <th>ROLES</th>
                    <th style={{ width: '18%' }}>EXPIRY (NEW GRANTS)</th>
                  </tr>
                </thead>
                <tbody>
                  {apps
                    .filter((a) => a.is_active)
                    .map((appOption) => {
                      const anyChecked = appOption.roles.some((r) => selectedRoles[roleKey(appOption.id, r.id)]);
                      return (
                        <tr key={appOption.id} className={anyChecked ? 'row-selected' : ''}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: appOption.color || '#6B2144',
                                  display: 'inline-block',
                                }}
                              />
                              <span>{appOption.name}</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                              {INTEGRATION_LABELS[appOption.integration_type]}
                            </div>
                          </td>
                          <td>
                            {appOption.roles.length === 0 ? (
                              <span className="console-muted-note">No roles in catalogue</span>
                            ) : (
                              <div className="role-checkbox-grid">
                                {appOption.roles.map((r) => {
                                  const key = roleKey(appOption.id, r.id);
                                  const checked = !!selectedRoles[key];
                                  const changed = checked !== currentKeys.has(key);
                                  return (
                                    <label key={r.id} className={changed ? 'is-change' : ''}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!accessUser.is_active && !currentKeys.has(key)}
                                        onChange={(e) => toggleRole(appOption.id, r.id, e.target.checked)}
                                      />
                                      <span>{r.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td>
                            <input
                              type="date"
                              className="odoo-role-select"
                              value={expiryByApp[appOption.id] || ''}
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => {
                                setExpiryByApp({ ...expiryByApp, [appOption.id]: e.target.value });
                                setPlannedChanges(null);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {plannedChanges && (
                <div className="planned-changes-list">
                  <strong>Review: {plannedChanges.length} change(s)</strong>
                  {plannedChanges.map((c, i) => (
                    <div key={i} className="planned-change-row">
                      <span className={`planned-change-action ${c.action}`}>{c.action}</span>
                      <div>
                        <div>
                          <strong>{c.application_name}</strong> / {c.app_role}
                          {c.expires_at && <span className="cell-muted"> (expires {formatDate(c.expires_at)})</span>}
                        </div>
                        <div className="console-muted-note">{c.outcome}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-form-footer">
              <button type="button" className="btn-modal-cancel" onClick={closeAccessEditor}>
                Close
              </button>
              {plannedChanges ? (
                <>
                  <button type="button" className="table-action-btn" onClick={() => setPlannedChanges(null)}>
                    Back
                  </button>
                  <button type="button" className="btn-plum-action" onClick={handleConfirmChanges} disabled={busy}>
                    {busy ? 'Submitting…' : 'Confirm changes'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-plum-action"
                  onClick={handleReviewChanges}
                  disabled={!hasPendingChanges || busy || accessLoading}
                >
                  {busy ? 'Checking…' : `Review changes (${pendingGrants.length + pendingRevokes.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: REGISTER NEW APPLICATION
      ───────────────────────────────────────────────────────────── */}
      {isRegisterAppOpen && (
        <div className="master-modal-backdrop" onClick={() => setIsRegisterAppOpen(false)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Application</h2>
              <button className="modal-close-btn" onClick={() => setIsRegisterAppOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterApplication} className="modal-body-scrollable">
              <p className="field-hint" style={{ marginBottom: 16 }}>
                Register an independently hosted application so its access can be governed from In2ERP.
              </p>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Application Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. In2SupplyChain"
                    value={newAppForm.name}
                    onChange={(e) =>
                      setNewAppForm({
                        ...newAppForm,
                        name: e.target.value,
                        slug: e.target.value.toLowerCase().trim().replace(/\s+/g, '-'),
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Application Slug *</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.slug}
                    onChange={(e) => setNewAppForm({ ...newAppForm, slug: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newAppForm.category}
                    onChange={(e) => setNewAppForm({ ...newAppForm, category: e.target.value })}
                  >
                    <option value="Operations">Operations & Supply</option>
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">Human Resources</option>
                    <option value="Productivity">Productivity & Collaboration</option>
                    <option value="Engineering">Engineering & DevOps</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Theme Color</label>
                  <input
                    type="color"
                    value={newAppForm.themeColor}
                    onChange={(e) => setNewAppForm({ ...newAppForm, themeColor: e.target.value })}
                    style={{ height: 38, padding: 2 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Launch URL</label>
                <input
                  type="text"
                  placeholder="https://supplychain.in2itebs.com"
                  value={newAppForm.url}
                  onChange={(e) => setNewAppForm({ ...newAppForm, url: e.target.value })}
                />
                <span className="field-hint">
                  Where employees are sent once their access is verified. The application must handle its own sign-in.
                </span>
              </div>

              <div className="form-group">
                <label>Integration</label>
                <select
                  value={newAppForm.integrationType}
                  onChange={(e) => setNewAppForm({ ...newAppForm, integrationType: e.target.value as IntegrationType })}
                >
                  {(Object.keys(INTEGRATION_LABELS) as IntegrationType[]).map((t) => (
                    <option key={t} value={t}>
                      {INTEGRATION_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {newAppForm.integrationType === 'entra_app_roles' && (
                <div className="form-group">
                  <label>Service principal (enterprise app) object ID</label>
                  <input
                    type="text"
                    value={newAppForm.servicePrincipalId}
                    onChange={(e) => setNewAppForm({ ...newAppForm, servicePrincipalId: e.target.value })}
                  />
                </div>
              )}
              {(newAppForm.integrationType === 'scim' || newAppForm.integrationType === 'custom_api') && (
                <div className="form-group">
                  <label>Connector base URL</label>
                  <input
                    type="text"
                    placeholder="https://app.example.com/in2erp/v1"
                    value={newAppForm.baseUrl}
                    onChange={(e) => setNewAppForm({ ...newAppForm, baseUrl: e.target.value })}
                  />
                </div>
              )}
              {newAppForm.integrationType !== 'manual' && (
                <div className="form-group">
                  <label>Credential secret name</label>
                  <input
                    type="text"
                    placeholder={newAppForm.integrationType === 'entra_app_roles' ? 'GRAPH_CLIENT_SECRET (default)' : 'e.g. SUPPLYCHAIN_API_TOKEN'}
                    value={newAppForm.secretRef}
                    onChange={(e) => setNewAppForm({ ...newAppForm, secretRef: e.target.value.toUpperCase() })}
                  />
                  <span className="field-hint">
                    The name of a server environment variable / Key Vault reference — never the secret value itself.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label>Roles defined by this application (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Supply Chain Lead, Warehouse Manager, Viewer"
                  value={newAppForm.rolesString}
                  onChange={(e) => setNewAppForm({ ...newAppForm, rolesString: e.target.value })}
                />
                <span className="field-hint">
                  These must mirror the application's own roles. For connector integrations you can instead use “Sync
                  roles from app” after registering.
                </span>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={newAppForm.description}
                  onChange={(e) => setNewAppForm({ ...newAppForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="toggle-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newAppForm.requiresLicense}
                    onChange={(e) => setNewAppForm({ ...newAppForm, requiresLicense: e.target.checked })}
                  />
                  <span>Requires a licence</span>
                </label>
              </div>

              <div className="modal-form-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsRegisterAppOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-plum-action" disabled={busy}>
                  {busy ? 'Registering…' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL: MANAGE APPLICATION ROLES & CONNECTOR
      ───────────────────────────────────────────────────────────── */}
      {managingRolesApp && (
        <div className="master-modal-backdrop" onClick={() => setManagingRolesAppId(null)}>
          <div className="master-modal-card" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{managingRolesApp.name} — Roles & Integration</h2>
              <button className="modal-close-btn" onClick={() => setManagingRolesAppId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              <div className="access-section">
                <div>
                  <Plug size={14} style={{ verticalAlign: -2 }} /> {INTEGRATION_LABELS[managingRolesApp.integration_type]} •
                  status <strong>{managingRolesApp.integration_status}</strong>
                </div>
                {managingRolesApp.last_connection_error && (
                  <div className="access-error-text">{managingRolesApp.last_connection_error}</div>
                )}
                {managingRolesApp.integration_type === 'manual' ? (
                  <>
                    <div className="console-muted-note" style={{ marginTop: 6 }}>
                      No connector: the application owner applies each change in {managingRolesApp.name} and it is
                      then confirmed here.
                    </div>
                    <div className="access-section-actions">
                      <button className="table-action-btn" onClick={handleConfirmAllManual}>
                        <Check size={13} />
                        <span>Confirm all pending manual changes</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="access-section-actions">
                    <button className="table-action-btn" onClick={handleTestConnection} disabled={busy}>
                      <Plug size={13} />
                      <span>Test connection</span>
                    </button>
                    <button className="table-action-btn" onClick={handleSyncRoles} disabled={busy}>
                      <RefreshCw size={13} />
                      <span>Sync roles from app</span>
                    </button>
                  </div>
                )}
                {connectorResult && (
                  <div
                    className={`prov-badge ${connectorResult.ok ? 'ok' : 'bad'}`}
                    style={{ whiteSpace: 'normal', marginTop: 8, display: 'block', borderRadius: 6, padding: '6px 10px' }}
                  >
                    {connectorResult.message}
                  </div>
                )}
              </div>

              <p className="field-hint">
                These roles mirror the roles <strong>{managingRolesApp.name}</strong> defines and enforces. The
                external ID is the role's identifier in the application (Entra app role ID, SCIM group ID, …) and is
                required before a connector can provision it.
              </p>

              <table className="odoo-access-matrix-table">
                <thead>
                  <tr>
                    <th>ROLE</th>
                    <th>EXTERNAL ID</th>
                    <th>SOURCE</th>
                    <th>SYNC</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {managingRolesApp.roles.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        {r.is_default && <span className="system-tag-sub">default</span>}
                      </td>
                      <td className="cell-code-mono">{r.external_role_id || '—'}</td>
                      <td className="cell-muted">{r.source}</td>
                      <td>
                        <span
                          className={`prov-badge ${r.sync_status === 'verified' ? 'ok' : r.sync_status === 'missing' ? 'bad' : 'muted'}`}
                        >
                          {r.sync_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="icon-only-btn" title="Remove role" onClick={() => handleDeleteRole(r.id, r.name)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {managingRolesApp.roles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="console-muted-note">
                        No roles yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="inline-form-row" style={{ marginTop: 18 }}>
                <input
                  type="text"
                  placeholder="Role name (as defined in the application)"
                  value={newRoleInput}
                  onChange={(e) => setNewRoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoleToApp()}
                />
                <input
                  type="text"
                  placeholder="External role ID (optional)"
                  value={newRoleExternalId}
                  onChange={(e) => setNewRoleExternalId(e.target.value)}
                />
                <button className="btn-plum-action" onClick={handleAddRoleToApp} disabled={!newRoleInput.trim()}>
                  <Plus size={15} />
                  <span>Add Role</span>
                </button>
              </div>
            </div>

            <div className="modal-form-footer">
              <button className="btn-plum-action" onClick={() => setManagingRolesAppId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL: ONE-TIME PASSWORD (shown once)
      ───────────────────────────────────────────────────────────── */}
      {oneTimePassword && (
        <div className="master-modal-backdrop">
          <div className="master-modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Key size={18} color="#6B2144" />
                <div>
                  <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#1E293B' }}>
                    {oneTimePassword.reason === 'created' ? 'Employee created' : 'Password reset'}
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {oneTimePassword.user.first_name} {oneTimePassword.user.last_name} ({oneTimePassword.user.email})
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-body-scrollable">
              <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                This one-time password is shown <strong>only now</strong>. Give it to the employee through a secure
                channel. They must choose a new password at first sign-in at{' '}
                <code>{window.location.origin}/login</code>.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="one-time-secret" style={{ flex: 1 }}>
                  {oneTimePassword.password}
                </div>
                <button
                  type="button"
                  className="table-action-btn"
                  title="Copy password"
                  onClick={() => {
                    navigator.clipboard?.writeText(oneTimePassword.password);
                    showToast('One-time password copied');
                  }}
                >
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="modal-form-footer">
              <button className="btn-plum-action" onClick={closeOneTimePassword}>
                {openAccessAfterPassword ? 'Done — assign application roles' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`master-toast-notification ${toast.error ? 'is-error' : ''}`} role={toast.error ? 'alert' : 'status'}>
          {toast.error ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
