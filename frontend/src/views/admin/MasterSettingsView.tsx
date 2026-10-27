import React, { useState, useEffect } from 'react';
import { useAuth } from '@/stores/AuthContext';
import { userService } from '@/services/userService';
import { roleService } from '@/services/roleService';
import { applicationService } from '@/services/applicationService';
import { User, Role, Application } from '@/types';
import { In2ITMark } from '@/components/In2ITMark';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit2,
  RotateCcw,
  Layers,
  Shield,
  ShieldCheck,
  Users,
  Grid,
  Bot,
  Bell,
  Sparkles,
  Calendar,
  Clock,
  Briefcase,
  FileText,
  BarChart2,
  TrendingUp,
  Settings,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ArrowLeft,
  X,
  Check,
  Sliders,
  Send,
  MessageSquare,
  Lock,
  History,
  Building,
  DollarSign,
  UserCheck,
} from 'lucide-react';

type MainTab =
  | 'users'
  | 'roles'
  | 'master_lists'
  | 'products'
  | 'tags'
  | 'pipeline_stages'
  | 'stage_questions'
  | 'ai_assistant'
  | 'email_templates'
  | 'notifications';

type RolesSubTab =
  | 'roles_list'
  | 'role_matrix'
  | 'permission_sets'
  | 'user_assignment'
  | 'data_scopes'
  | 'approval_permissions'
  | 'permissions'
  | 'audit_log';

export const MasterSettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<MainTab>('users');
  const [rolesSubTab, setRolesSubTab] = useState<RolesSubTab>('roles_list');

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New User Form State
  const [newUserForm, setNewUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: 'Sales',
    designation: 'Sales Manager',
    phone: '',
    role: 'Sales Manager',
    assignedApps: ['in2crm'] as string[],
    appRoles: {
      in2crm: 'Sales Manager',
      'project-mgmt': 'Member',
      'hr-management': 'Staff',
      'leave-mgmt': 'Requester',
      finance: 'Viewer',
    } as Record<string, string>,
    aiAssistantEnabled: true,
    aiAssistantScope: 'pipeline_insights',
  });

  // AI Assistant Tab State
  const [aiModel, setAiModel] = useState('In2IT Converged Intelligence v2.0 (Gemini 1.5 Grounded)');
  const [aiAppToggles, setAiAppToggles] = useState({
    in2crm: true,
    'project-mgmt': true,
    'hr-management': false,
    'leave-mgmt': true,
    finance: false,
  });
  const [aiTestPrompt, setAiTestPrompt] = useState('');
  const [aiTestResponse, setAiTestResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Data Scopes State (Screenshot 5)
  const [dataScopes, setDataScopes] = useState<Record<string, { dealRead: string; dealWrite: string; leadRead: string; leadWrite: string }>>({
    ADMIN: { dealRead: 'all *', dealWrite: 'all *', leadRead: 'all *', leadWrite: 'all *' },
    CRO: { dealRead: 'all', dealWrite: 'all', leadRead: 'none', leadWrite: 'none' },
    SALES: { dealRead: 'own', dealWrite: 'own', leadRead: 'own', leadWrite: 'own' },
    SALES_MANAGER: { dealRead: 'team', dealWrite: 'team', leadRead: 'team', leadWrite: 'team' },
    PRACTICE_LEAD: { dealRead: 'practice', dealWrite: 'practice', leadRead: 'none', leadWrite: 'none' },
    FINANCE: { dealRead: 'all', dealWrite: 'none', leadRead: 'none', leadWrite: 'none' },
    VIEWER: { dealRead: 'all', dealWrite: 'none', leadRead: 'all', leadWrite: 'none' },
    EXEC_CHAIRMAN: { dealRead: 'all', dealWrite: 'all', leadRead: 'all', leadWrite: 'all' },
    PROJECT_MANAGER: { dealRead: 'practice', dealWrite: 'practice', leadRead: 'none', leadWrite: 'none' },
  });

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
    } catch (err) {
      console.error('Failed to load master settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Submit Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email || !newUserForm.firstName || !newUserForm.lastName) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      await userService.createUser({
        email: newUserForm.email,
        password: 'password123',
        first_name: newUserForm.firstName,
        last_name: newUserForm.lastName,
        department: newUserForm.department,
        designation: newUserForm.designation,
        phone: newUserForm.phone,
      });

      showToast(`User ${newUserForm.firstName} ${newUserForm.lastName} created with scoped application access.`);
      setIsAddUserOpen(false);
      // Reset
      setNewUserForm({
        firstName: '',
        lastName: '',
        email: '',
        department: 'Sales',
        designation: 'Sales Manager',
        phone: '',
        role: 'Sales Manager',
        assignedApps: ['in2crm'],
        appRoles: {
          in2crm: 'Sales Manager',
          'project-mgmt': 'Member',
          'hr-management': 'Staff',
          'leave-mgmt': 'Requester',
          finance: 'Viewer',
        },
        aiAssistantEnabled: true,
        aiAssistantScope: 'pipeline_insights',
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create user');
    }
  };

  // Run AI Test Prompt
  const handleRunAiPrompt = () => {
    if (!aiTestPrompt.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      setAiTestResponse(
        `[In2IT Converged AI]: Based on the active Q4 enterprise pipeline, ${newUserForm.designation || 'Sales Manager'} has 18 active deals valued at $1,420,000. 6 deals are currently in Final Negotiation with an estimated close probability of 82%. Recommendation: Expedite legal clearance for deal #IN2-789.`
      );
      setAiLoading(false);
    }, 700);
  };

  // Filtered users for search
  const filteredUsers = users.filter((u) => {
    const term = searchQuery.toLowerCase();
    return (
      u.first_name.toLowerCase().includes(term) ||
      u.last_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.designation && u.designation.toLowerCase().includes(term))
    );
  });

  return (
    <div className="master-settings-layout">
      {/* ─────────────────────────────────────────────────────────────
          1. LEFT SIDEBAR (Dark Navy #121E3B - Exact Match)
      ───────────────────────────────────────────────────────────── */}
      <aside className="master-sidebar">
        {/* Top Logo & Launchpad return */}
        <div className="master-sidebar-brand">
          <div className="brand-pill-container" onClick={() => navigate('/')} title="Click to return to Launchpad">
            <In2ITMark size={28} color="#121E3B" />
            <div className="brand-text">
              <span className="brand-name">In2IT EBS</span>
              <span className="brand-sub">CONVERGED INTELLIGENCE</span>
            </div>
          </div>
        </div>

        {/* Active Application Switcher Banner */}
        <div className="active-app-banner">
          <div className="app-banner-title">In2CRM</div>
          <div className="app-banner-sub">Enterprise Pipeline v2.0</div>
        </div>

        {/* Navigation Sections */}
        <nav className="master-nav-tree">
          {/* Top general items */}
          <div className="nav-group">
            <div className="nav-tree-item">
              <Calendar size={16} />
              <span>Meetings</span>
            </div>
            <div className="nav-tree-item">
              <Clock size={16} />
              <span>Deadlines</span>
            </div>
          </div>

          {/* GOVERN Section */}
          <div className="nav-group">
            <div className="nav-group-header">GOVERN</div>
            <div className="nav-tree-item">
              <Shield size={16} />
              <span>Approvals</span>
            </div>
            <div className="nav-tree-item">
              <FileText size={16} />
              <span>Tenders</span>
            </div>
            <div className="nav-tree-item">
              <CheckCircle2 size={16} />
              <span>Post-Award</span>
            </div>
            <div className="nav-tree-item">
              <Users size={16} />
              <span>Sales Teams</span>
            </div>
          </div>

          {/* ANALYSE Section */}
          <div className="nav-group">
            <div className="nav-group-header">ANALYSE</div>
            <div
              className={`nav-tree-item ${activeTab === 'ai_assistant' ? 'active-highlight' : ''}`}
              onClick={() => setActiveTab('ai_assistant')}
            >
              <Sparkles size={16} color="#EC4899" />
              <span>AI Assistant</span>
            </div>
            <div className="nav-tree-item">
              <BarChart2 size={16} />
              <span>Reports</span>
            </div>
            <div className="nav-tree-item">
              <TrendingUp size={16} />
              <span>Forecasting</span>
            </div>
            <div className="nav-tree-item">
              <ShieldCheck size={16} />
              <span>Data Quality</span>
            </div>
          </div>

          {/* CONFIGURE (ADMIN ONLY) Section */}
          <div className="nav-group">
            <div className="nav-group-header">CONFIGURE (ADMIN ONLY)</div>
            <div className="nav-tree-item">
              <Sliders size={16} />
              <span>Import Data</span>
            </div>
            <div className="nav-tree-item active-plum-nav">
              <Settings size={16} />
              <span>Master Data & Settings</span>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer: Return to Launchpad & User */}
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
        {/* Top Header Bar */}
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

            {/* AI Assistant quick badge */}
            <button
              className="header-icon-badge"
              onClick={() => setActiveTab('ai_assistant')}
              title="Open AI Assistant Configuration"
            >
              <Bot size={18} color="#0284C7" />
              <span className="badge-online-dot" />
            </button>

            {/* Notification bell */}
            <button className="header-icon-badge" title="System Notifications">
              <Bell size={18} color="#64748B" />
            </button>

            {/* Admin Avatar */}
            <div className="header-admin-avatar">
              <span>{user ? `${user.first_name[0] || 'S'}${user.last_name[0] || 'A'}` : 'SA'}</span>
            </div>
          </div>
        </header>

        {/* Top Horizontal Category Tabs (Screenshot 1-5 Match) */}
        <div className="master-category-tabs-bar">
          <button
            className={`category-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users & access
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Roles & permissions
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'master_lists' ? 'active' : ''}`}
            onClick={() => setActiveTab('master_lists')}
          >
            Master lists
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
          >
            Tags
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'pipeline_stages' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline_stages')}
          >
            Pipeline stages
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'stage_questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('stage_questions')}
          >
            Stage questions
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'ai_assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai_assistant')}
          >
            AI assistant
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'email_templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('email_templates')}
          >
            Email templates
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. TAB CONTENT
        ───────────────────────────────────────────────────────────── */}
        <div className="master-tab-content-area">
          {/* ════════════════════════════════════════════════════════════
              TAB 1: Users & access (Screenshot 1)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  {filteredUsers.length} USERS
                </div>
                <button
                  className="btn-plum-action"
                  onClick={() => setIsAddUserOpen(true)}
                >
                  <Plus size={16} />
                  <span>Add user</span>
                </button>
              </div>

              {/* Users Table */}
              <div className="master-data-table-wrapper">
                <table className="master-data-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>EMAIL</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>LAST LOGIN</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const roleDisplay = u.designation || (u.is_superadmin ? 'Administrator' : 'Employee');
                      return (
                        <tr key={u.id}>
                          <td className="cell-name-bold">
                            {u.first_name} {u.last_name}
                          </td>
                          <td className="cell-muted">{u.email}</td>
                          <td>
                            <span className="role-lavender-badge">
                              {roleDisplay}
                            </span>
                          </td>
                          <td>
                            <span className="status-active-pill">
                              Active
                            </span>
                          </td>
                          <td className="cell-muted">
                            {u.last_login_at
                              ? new Date(u.last_login_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '27 Oct 2026'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-actions-group">
                              <button
                                className="table-action-btn"
                                onClick={() => showToast(`Edit user ${u.first_name} ${u.last_name}`)}
                                title="Edit user"
                              >
                                <Edit2 size={14} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="table-action-btn"
                                onClick={() => showToast(`Password reset link dispatched for ${u.email}`)}
                                title="Reset credentials"
                              >
                                <RotateCcw size={14} />
                                <span>Reset</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 2: Roles & permissions (Screenshots 2, 3, 4, 5)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'roles' && (
            <div className="settings-card-panel">
              {/* Secondary Sub-Tabs Pill Row (Screenshot 2-5) */}
              <div className="roles-subtabs-pill-row">
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'roles_list' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('roles_list')}
                >
                  <Shield size={14} />
                  <span>Roles</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'role_matrix' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('role_matrix')}
                >
                  <Grid size={14} />
                  <span>Role Matrix</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'permission_sets' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('permission_sets')}
                >
                  <Layers size={14} />
                  <span>Permission Sets</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'user_assignment' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('user_assignment')}
                >
                  <UserCheck size={14} />
                  <span>User Assignment</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'data_scopes' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('data_scopes')}
                >
                  <ShieldCheck size={14} />
                  <span>Data Scopes</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'approval_permissions' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('approval_permissions')}
                >
                  <CheckCircle2 size={14} />
                  <span>Approval Permissions</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'permissions' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('permissions')}
                >
                  <Lock size={14} />
                  <span>Permissions</span>
                </button>
                <button
                  className={`subtab-pill-btn ${rolesSubTab === 'audit_log' ? 'active' : ''}`}
                  onClick={() => setRolesSubTab('audit_log')}
                >
                  <History size={14} />
                  <span>Audit Log</span>
                </button>
              </div>

              {/* Sub-Tab 1: Roles List (Screenshot 2) */}
              {rolesSubTab === 'roles_list' && (
                <div>
                  <div className="panel-top-action-bar">
                    <div className="panel-count-label">
                      Roles • {roles.length || 9}
                    </div>
                    <button
                      className="btn-plum-action"
                      onClick={() => setIsAddRoleOpen(true)}
                    >
                      <Plus size={16} />
                      <span>New role</span>
                    </button>
                  </div>

                  <div className="master-data-table-wrapper">
                    <table className="master-data-table">
                      <thead>
                        <tr>
                          <th>ROLE</th>
                          <th>CODE</th>
                          <th>DESCRIPTION</th>
                          <th>GRANTS</th>
                          <th>USERS</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Administrator', code: 'ADMIN', desc: 'Full system access including master data and pipeline configuration.', grants: 'ALL (*)', users: 2, isAll: true },
                          { name: 'Chief Revenue Officer', code: 'CRO', desc: 'Owns the portfolio. Sees all deals, approves Go/No-Go, sets tiering.', grants: '71 -1', users: 2 },
                          { name: 'Salesperson', code: 'SALES', desc: 'Creates and works deals they own or are on the team for.', grants: '69', users: 1 },
                          { name: 'Sales Manager', code: 'SALES_MANAGER', desc: 'Leads a sales team. Decides Prospect->Lead promotion. Team-scoped visibility.', grants: '73', users: 1 },
                          { name: 'Practice Lead', code: 'PRACTICE_LEAD', desc: 'Owns solutioning and resourcing for a practice group.', grants: '64', users: 2 },
                          { name: 'Finance Approver', code: 'FINANCE', desc: 'Decides Internal Finance Approval (GOV-08) and Review (PVT-06).', grants: '61', users: 1 },
                          { name: 'Read Only', code: 'VIEWER', desc: 'Reporting access with no write capability.', grants: '60', users: 2 },
                          { name: 'Executive Chairman', code: 'EXEC_CHAIRMAN', desc: 'Board-level sign-off. Axis 6 names the ExCh on eight stages, and FieldGovernance requires ExCh approval on any deal above Rs1 Cr TCV.', grants: '63', users: 1 },
                          { name: 'Project Manager', code: 'PROJECT_MANAGER', desc: 'Project delivery tracking, sprint allocation and milestone governance.', grants: '65', users: 1 },
                        ].map((r, i) => (
                          <tr key={i}>
                            <td>
                              <span className="role-lavender-badge">{r.name}</span>
                              <span className="system-tag-sub">system</span>
                            </td>
                            <td className="cell-code-mono">{r.code}</td>
                            <td className="cell-desc-text">{r.desc}</td>
                            <td>
                              {r.isAll ? (
                                <span className="grants-all-badge">ALL (*)</span>
                              ) : (
                                <span className="cell-muted">{r.grants}</span>
                              )}
                            </td>
                            <td className="cell-muted">{r.users}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-group">
                                <button className="icon-only-btn" title="Edit role">
                                  <Edit2 size={15} />
                                </button>
                                <button className="icon-only-btn" title="View permission layers">
                                  <Layers size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Role Matrix (Screenshot 3) */}
              {rolesSubTab === 'role_matrix' && (
                <div>
                  <div className="matrix-toolbar-header">
                    <div className="matrix-header-info">
                      <span className="matrix-title">Role Matrix</span>
                      <span className="matrix-subtitle">• 137 permissions × 9 roles</span>
                    </div>

                    <div className="matrix-legend-row">
                      <span className="legend-item"><span className="legend-dot green" /> Allow</span>
                      <span className="legend-item"><span className="legend-dot red" /> Deny</span>
                      <span className="legend-item"><span className="legend-dot purple" /> via *</span>
                    </div>
                  </div>

                  {/* Filter controls */}
                  <div className="matrix-filter-bar">
                    <div className="matrix-search-input">
                      <Search size={14} color="#94A3B8" />
                      <input type="text" placeholder="Filter permissions..." />
                    </div>
                    <select className="matrix-filter-select">
                      <option>All modules</option>
                      <option>Dashboard</option>
                      <option>Pipeline</option>
                      <option>Deals</option>
                      <option>Leads</option>
                    </select>
                    <select className="matrix-filter-select">
                      <option>All levels</option>
                      <option>Module level</option>
                      <option>Record level</option>
                    </select>
                  </div>

                  {/* Matrix Table (Screenshot 3 Match) */}
                  <div className="master-data-table-wrapper">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>PERMISSION</th>
                          <th>ADMIN</th>
                          <th>CRO</th>
                          <th>SALES</th>
                          <th>SALES_MGR</th>
                          <th>PRACTICE</th>
                          <th>FINANCE</th>
                          <th>VIEWER</th>
                          <th>EX_CHAIR</th>
                          <th>PM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { category: 'DASHBOARD', code: 'module.dashboard', label: 'Access module: Dashboard' },
                          { category: 'PIPELINE', code: 'module.pipeline', label: 'Access module: Pipeline' },
                          { category: 'DEALS', code: 'module.deals', label: 'Access module: Deals' },
                          { category: 'LEADS', code: 'module.leads', label: 'Access module: Leads' },
                          { category: 'ACCOUNTS', code: 'module.accounts', label: 'Access module: Accounts' },
                          { category: 'CONTACTS', code: 'module.contacts', label: 'Access module: Contacts' },
                          { category: 'REPORTS', code: 'module.reports', label: 'Access module: Reports' },
                        ].map((m, idx) => (
                          <React.Fragment key={idx}>
                            <tr className="matrix-category-header-row">
                              <td colSpan={10}>{m.category}</td>
                            </tr>
                            <tr>
                              <td>
                                <div className="perm-cell-content">
                                  <span className="perm-badge-pill">module</span>
                                  <div>
                                    <div className="perm-label">{m.label}</div>
                                    <div className="perm-code">{m.code}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="matrix-cell"><span className="dot-via-star">●</span></td>
                              <td className="matrix-cell">{idx === 0 ? <span className="icon-deny">✕</span> : <span className="icon-allow">✓</span>}</td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                              <td className="matrix-cell"><span className="icon-allow">✓</span></td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: User Assignment (Screenshot 4) */}
              {rolesSubTab === 'user_assignment' && (
                <div>
                  <div className="panel-top-action-bar">
                    <div className="panel-count-label">
                      <strong>User Access</strong> • primary role + overrides
                    </div>
                  </div>

                  <div className="master-data-table-wrapper">
                    <table className="master-data-table">
                      <thead>
                        <tr>
                          <th>USER</th>
                          <th>PRIMARY ROLE</th>
                          <th>SECONDARY ROLES</th>
                          <th>OVERRIDES</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => {
                          const roleKey = u.is_superadmin
                            ? 'ADMIN'
                            : (u.designation?.toUpperCase().replace(/\s+/g, '_') || 'SALES');
                          return (
                            <tr key={u.id}>
                              <td>
                                <div className="cell-name-bold">{u.first_name} {u.last_name}</div>
                                <div className="cell-muted-sm">{u.email}</div>
                              </td>
                              <td>
                                <span className="role-lavender-badge">{roleKey}</span>
                              </td>
                              <td className="cell-muted">—</td>
                              <td className="cell-muted">—</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="table-action-btn"
                                  onClick={() => showToast(`Managing role assignments for ${u.first_name}`)}
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Data Scopes (Screenshot 5) */}
              {rolesSubTab === 'data_scopes' && (
                <div>
                  <div className="panel-top-action-bar">
                    <div className="panel-count-label">
                      <strong>Data Access Scopes</strong> • row-level visibility per role × resource
                    </div>
                  </div>

                  {/* Informational Alert Box (Screenshot 5 Exact) */}
                  <div className="data-scopes-alert-box">
                    <Shield size={18} color="#0284C7" />
                    <div>
                      <strong>Read</strong> controls which rows a role can see; <strong>Write</strong> which it can edit. Scope widens: <code>own ⊂ practice ⊂ team ⊂ all</code>.
                    </div>
                  </div>

                  {/* Data Scopes Table (Screenshot 5 Exact) */}
                  <div className="master-data-table-wrapper">
                    <table className="data-scopes-table">
                      <thead>
                        <tr className="header-grouped-row">
                          <th rowSpan={2}>ROLE</th>
                          <th colSpan={2} className="group-col-header">DEAL / LEAD</th>
                          <th colSpan={2} className="group-col-header">ACCOUNT / CONTACT</th>
                        </tr>
                        <tr className="header-sub-row">
                          <th>READ</th>
                          <th>WRITE</th>
                          <th>READ</th>
                          <th>WRITE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dataScopes).map(([roleCode, scopes]) => (
                          <tr key={roleCode}>
                            <td>
                              <span className="role-lavender-badge">{roleCode}</span>
                            </td>
                            {roleCode === 'ADMIN' ? (
                              <>
                                <td className="cell-muted">all *</td>
                                <td className="cell-muted">all *</td>
                                <td className="cell-muted">all *</td>
                                <td className="cell-muted">all *</td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <select
                                    className="scope-dropdown-select"
                                    value={scopes.dealRead}
                                    onChange={(e) =>
                                      setDataScopes({
                                        ...dataScopes,
                                        [roleCode]: { ...scopes, dealRead: e.target.value },
                                      })
                                    }
                                  >
                                    <option value="all">all</option>
                                    <option value="practice">practice</option>
                                    <option value="team">team</option>
                                    <option value="own">own</option>
                                    <option value="none">none</option>
                                  </select>
                                </td>
                                <td>
                                  <select
                                    className="scope-dropdown-select"
                                    value={scopes.dealWrite}
                                    onChange={(e) =>
                                      setDataScopes({
                                        ...dataScopes,
                                        [roleCode]: { ...scopes, dealWrite: e.target.value },
                                      })
                                    }
                                  >
                                    <option value="all">all</option>
                                    <option value="practice">practice</option>
                                    <option value="team">team</option>
                                    <option value="own">own</option>
                                    <option value="none">none</option>
                                  </select>
                                </td>
                                <td>
                                  <select
                                    className="scope-dropdown-select"
                                    value={scopes.leadRead}
                                    onChange={(e) =>
                                      setDataScopes({
                                        ...dataScopes,
                                        [roleCode]: { ...scopes, leadRead: e.target.value },
                                      })
                                    }
                                  >
                                    <option value="all">all</option>
                                    <option value="practice">practice</option>
                                    <option value="team">team</option>
                                    <option value="own">own</option>
                                    <option value="none">none</option>
                                  </select>
                                </td>
                                <td>
                                  <select
                                    className="scope-dropdown-select"
                                    value={scopes.leadWrite}
                                    onChange={(e) =>
                                      setDataScopes({
                                        ...dataScopes,
                                        [roleCode]: { ...scopes, leadWrite: e.target.value },
                                      })
                                    }
                                  >
                                    <option value="all">all</option>
                                    <option value="practice">practice</option>
                                    <option value="team">team</option>
                                    <option value="own">own</option>
                                    <option value="none">none</option>
                                  </select>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tabs: Permission Sets, Audit Log, etc. */}
              {rolesSubTab === 'audit_log' && (
                <div className="audit-subtab-view">
                  <div className="panel-count-label">Security Audit Trail • Immutable Compliance Trail</div>
                  <div className="audit-timeline-feed">
                    <div className="audit-item">
                      <div className="audit-dot" />
                      <div>
                        <strong>Role Assignment Updated</strong> for <em>Alex Morgan</em> → <code>Project Lead</code> on In2Projects
                        <div className="audit-time">26 Oct 2026, 17:15 IST • Administrator</div>
                      </div>
                    </div>
                    <div className="audit-item">
                      <div className="audit-dot" />
                      <div>
                        <strong>User Provisioned</strong> <em>Elisaya Nayak</em> with <code>Sales Manager</code> role on In2CRM
                        <div className="audit-time">27 Oct 2026, 07:04 IST • System Seed</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 3: Master lists
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
                    <h4>Departments (7)</h4>
                  </div>
                  <div className="master-items-list">
                    {['Sales', 'Engineering', 'Leadership', 'Finance', 'Human Resources', 'Operations', 'Audit & Legal'].map((d, i) => (
                      <div key={i} className="master-item-row">
                        <span>{d}</span>
                        <Check size={14} color="#10B981" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="master-list-card">
                  <div className="master-list-header">
                    <Grid size={18} color="#2563EB" />
                    <h4>Enterprise Branches & Entities (5)</h4>
                  </div>
                  <div className="master-items-list">
                    {['In2IT Bhubaneswar (HQ)', 'In2IT Bengaluru', 'In2IT UAE (Dubai)', 'In2IT UK (London)', 'In2IT Americas (New York)'].map((b, i) => (
                      <div key={i} className="master-item-row">
                        <span>{b}</span>
                        <span className="branch-active-tag">Active</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="master-list-card">
                  <div className="master-list-header">
                    <DollarSign size={18} color="#059669" />
                    <h4>Currencies & Fiscal (4)</h4>
                  </div>
                  <div className="master-items-list">
                    {[
                      { code: 'INR (₹)', name: 'Indian Rupee (Base)' },
                      { code: 'USD ($)', name: 'United States Dollar' },
                      { code: 'AED (د.إ)', name: 'UAE Dirham' },
                      { code: 'EUR (€)', name: 'Euro' },
                    ].map((c, i) => (
                      <div key={i} className="master-item-row">
                        <strong>{c.code}</strong>
                        <span className="cell-muted">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 4: AI assistant Settings & Application Access
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai_assistant' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>AI Assistant & Bot Access Governance</strong>
                </div>
              </div>

              <div className="ai-settings-container">
                {/* AI Model Architecture Box */}
                <div className="ai-model-box">
                  <div className="ai-model-icon">
                    <Bot size={32} color="#FFFFFF" />
                  </div>
                  <div className="ai-model-info">
                    <h3>In2IT Converged AI Copilot</h3>
                    <p>
                      Enterprise-grounded generative intelligence for CRM pipelines, Project forecasting, and HR policy automation.
                    </p>
                    <div className="ai-model-selector">
                      <label>Active Foundation Model:</label>
                      <select
                        className="form-select-sm"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                      >
                        <option value="In2IT Converged Intelligence v2.0 (Gemini 1.5 Grounded)">
                          In2IT Converged Intelligence v2.0 (Gemini 1.5 Grounded)
                        </option>
                        <option value="Gemini 1.5 Pro Enterprise (Direct API)">
                          Gemini 1.5 Pro Enterprise (Direct API)
                        </option>
                        <option value="Claude 3.5 Sonnet Enterprise Bridge">
                          Claude 3.5 Sonnet Enterprise Bridge
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Per-Application AI Access Toggles */}
                <div className="ai-app-toggles-section">
                  <h4 className="section-title">Application-Level AI Bot Access</h4>
                  <p className="section-desc">
                    Control which internal ERP business modules have the AI Assistant enabled for staff.
                  </p>

                  <div className="app-toggles-grid">
                    {[
                      { slug: 'in2crm', name: 'In2CRM', desc: 'Deal risk alerts, next-best action, proposal writing assistant', icon: 'Pipeline' },
                      { slug: 'project-mgmt', name: 'In2Projects', desc: 'Sprint delivery velocity, blocker summary, milestone risk prediction', icon: 'Projects' },
                      { slug: 'hr-management', name: 'In2HRM', desc: 'Leave policy inquiry, onboarding handbook, benefits FAQ bot', icon: 'HR' },
                      { slug: 'leave-mgmt', name: 'In2Leave', desc: 'Instant leave balance queries and manager approval recommendation', icon: 'Leave' },
                      { slug: 'finance', name: 'In2Finance', desc: 'Ledger discrepancy flags, invoice OCR extraction, audit checks', icon: 'Finance' },
                    ].map((appItem) => {
                      const isEnabled = (aiAppToggles as any)[appItem.slug] ?? false;
                      return (
                        <div key={appItem.slug} className={`app-toggle-card ${isEnabled ? 'enabled' : ''}`}>
                          <div className="toggle-card-header">
                            <div>
                              <h5>{appItem.name}</h5>
                              <span className="app-toggle-desc">{appItem.desc}</span>
                            </div>
                            <label className="switch-toggle">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) =>
                                  setAiAppToggles({
                                    ...aiAppToggles,
                                    [appItem.slug]: e.target.checked,
                                  })
                                }
                              />
                              <span className="slider-round" />
                            </label>
                          </div>
                          <div className="toggle-card-status">
                            {isEnabled ? (
                              <span className="status-badge-green">● AI Copilot Active</span>
                            ) : (
                              <span className="status-badge-grey">○ Disabled</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive AI Prompt Test Sandbox */}
                <div className="ai-sandbox-section">
                  <h4 className="section-title">Test AI Application Assistant</h4>
                  <div className="ai-prompt-box">
                    <div className="prompt-input-row">
                      <input
                        type="text"
                        placeholder="Ask In2IT Copilot: e.g., 'Summarize active deals in negotiation for Q4'..."
                        value={aiTestPrompt}
                        onChange={(e) => setAiTestPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRunAiPrompt()}
                      />
                      <button
                        className="btn-plum-action"
                        onClick={handleRunAiPrompt}
                        disabled={aiLoading}
                      >
                        {aiLoading ? 'Thinking...' : <Send size={16} />}
                      </button>
                    </div>

                    {aiTestResponse && (
                      <div className="ai-response-bubble">
                        <Sparkles size={18} color="#6B2144" />
                        <div className="response-text">{aiTestResponse}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              OTHER TABS: Products, Tags, Pipeline stages, etc.
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'products' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">Products & Applications Catalog • {apps.length} Modules</div>
              </div>
              <div className="master-data-table-wrapper">
                <table className="master-data-table">
                  <thead>
                    <tr>
                      <th>APPLICATION</th>
                      <th>SLUG</th>
                      <th>CATEGORY</th>
                      <th>STATUS</th>
                      <th>LICENSE</th>
                      <th>MAX USERS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id}>
                        <td className="cell-name-bold">{a.name}</td>
                        <td className="cell-code-mono">{a.slug}</td>
                        <td>{a.category}</td>
                        <td><span className="status-active-pill">Active</span></td>
                        <td>{a.requires_license ? 'Enterprise License' : 'Core Included'}</td>
                        <td>{a.max_users || 'Unlimited'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pipeline_stages' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">Pipeline Stages (In2CRM)</div>
              </div>
              <div className="stages-flow-diagram">
                {['01. Prospect Qualified', '02. Technical Discovery', '03. Proposal & Pricing', '04. Board / ExCh Signoff', '05. Contract & Closed Won'].map((s, idx) => (
                  <div key={idx} className="stage-block">
                    <span className="stage-index">{idx + 1}</span>
                    <span className="stage-title">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: + ADD USER (With Scoped Application Access & AI)
      ───────────────────────────────────────────────────────────── */}
      {isAddUserOpen && (
        <div className="master-modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Employee & Provision Application Access</h2>
              <button className="modal-close-btn" onClick={() => setIsAddUserOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-body-scrollable">
              {/* Section 1: Basic Employee Information */}
              <div className="form-section-title">1. Employee Personal & Corporate Identity</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={newUserForm.firstName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
                    value={newUserForm.lastName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john.doe@in2itebs.com"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Department</label>
                  <select
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                  >
                    <option value="Sales">Sales</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Leadership">Leadership</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Manager / Lead"
                    value={newUserForm.designation}
                    onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                  />
                </div>
              </div>

              {/* Section 2: Primary ERP System Role */}
              <div className="form-section-title">2. Primary ERP Security Role</div>
              <div className="form-group">
                <label>System Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                >
                  <option value="Sales Manager">Sales Manager</option>
                  <option value="Chief Revenue Officer">Chief Revenue Officer (CRO)</option>
                  <option value="Salesperson">Salesperson</option>
                  <option value="Practice Lead">Practice Lead</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Administrator">Administrator (Super Admin)</option>
                  <option value="Read Only">Read Only</option>
                </select>
                <span className="field-hint">
                  Governs system-wide baseline permissions and administrative dashboard visibility.
                </span>
              </div>

              {/* Section 3: Scoped Application Access */}
              <div className="form-section-title">3. Assign ERP Applications & Application Roles</div>
              <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                Select which applications this employee can launch, and configure their exact role within each application.
              </p>

              <div className="app-assignments-provision-stack">
                {[
                  { slug: 'in2crm', name: 'In2CRM (Pipeline)', roles: ['Sales Manager', 'Salesperson', 'CRO', 'Viewer'] },
                  { slug: 'project-mgmt', name: 'In2Projects', roles: ['Project Lead', 'Senior Developer', 'Contributor', 'Viewer'] },
                  { slug: 'hr-management', name: 'In2HRM', roles: ['HR Manager', 'People Partner', 'Staff'] },
                  { slug: 'leave-mgmt', name: 'In2Leave', roles: ['Approver', 'Requester / Staff'] },
                  { slug: 'finance', name: 'In2Finance', roles: ['Finance Approver', 'Accountant', 'Viewer'] },
                ].map((appOption) => {
                  const isChecked = newUserForm.assignedApps.includes(appOption.slug);
                  return (
                    <div key={appOption.slug} className={`provision-item ${isChecked ? 'selected' : ''}`}>
                      <label className="checkbox-app-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserForm({
                                ...newUserForm,
                                assignedApps: [...newUserForm.assignedApps, appOption.slug],
                              });
                            } else {
                              setNewUserForm({
                                ...newUserForm,
                                assignedApps: newUserForm.assignedApps.filter((s) => s !== appOption.slug),
                              });
                            }
                          }}
                        />
                        <span className="app-name-strong">{appOption.name}</span>
                      </label>

                      {isChecked && (
                        <div className="app-role-select-box">
                          <label>App Role:</label>
                          <select
                            value={newUserForm.appRoles[appOption.slug] || appOption.roles[0]}
                            onChange={(e) =>
                              setNewUserForm({
                                ...newUserForm,
                                appRoles: {
                                  ...newUserForm.appRoles,
                                  [appOption.slug]: e.target.value,
                                },
                              })
                            }
                          >
                            {appOption.roles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Section 4: AI Assistant Privileges */}
              <div className="form-section-title">4. AI Assistant & Chatbot Access</div>
              <div className="ai-provision-box">
                <label className="toggle-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newUserForm.aiAssistantEnabled}
                    onChange={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        aiAssistantEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>Enable In2IT AI Copilot & Chatbot for this Employee</span>
                </label>

                {newUserForm.aiAssistantEnabled && (
                  <div className="ai-scope-selector" style={{ marginTop: 10 }}>
                    <label>AI Assistant Permission Level:</label>
                    <select
                      value={newUserForm.aiAssistantScope}
                      onChange={(e) =>
                        setNewUserForm({
                          ...newUserForm,
                          aiAssistantScope: e.target.value,
                        })
                      }
                    >
                      <option value="general_queries">General Queries & Document Lookup</option>
                      <option value="pipeline_insights">Pipeline Insights & Forecasting (CRM/Projects)</option>
                      <option value="admin_automation">Full Action Automation (Approve/Reassign)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="modal-form-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-plum-action">
                  Save & Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="master-toast-notification">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
