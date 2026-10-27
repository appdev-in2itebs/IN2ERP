import React, { useState, useEffect } from 'react';
import { useAuth } from '@/stores/AuthContext';
import { userService } from '@/services/userService';
import { roleService } from '@/services/roleService';
import { applicationService } from '@/services/applicationService';
import { User, Role } from '@/types';
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
  Briefcase,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
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
  Mail,
  PlusCircle,
  Key,
  ExternalLink,
} from 'lucide-react';

// Explicit 7 Tabs requested by User:
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

export interface RegisteredApp {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  iconName: string;
  themeColor: string;
  routeUrl: string;
  requiresLicense: boolean;
  isActive: boolean;
  availableRoles: string[];
}

export const MasterSettingsView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<MainTab>('users');
  const [rolesSubTab, setRolesSubTab] = useState<RolesSubTab>('roles_list');

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isRegisterAppOpen, setIsRegisterAppOpen] = useState(false);
  const [managingRolesApp, setManagingRolesApp] = useState<RegisteredApp | null>(null);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Application Registry State (Pre-populated with In2ERP modules & extensible by admin)
  const [registeredApps, setRegisteredApps] = useState<RegisteredApp[]>([
    {
      id: 'app-crm',
      name: 'In2CRM',
      slug: 'in2crm',
      category: 'Sales & Revenue',
      description: 'Enterprise pipeline, deals, accounts, and territory governance.',
      iconName: 'Pipeline',
      themeColor: '#6B2144',
      routeUrl: '/apps/crm',
      requiresLicense: true,
      isActive: true,
      availableRoles: [
        'Administrator',
        'Chief Revenue Officer',
        'Sales Manager',
        'Salesperson',
        'Practice Lead',
        'Finance Approver',
        'Read Only',
      ],
    },
    {
      id: 'app-proj',
      name: 'In2Projects',
      slug: 'project-mgmt',
      category: 'Delivery & Sprints',
      description: 'Milestone tracking, sprint velocity, timesheets, and resource allocation.',
      iconName: 'Projects',
      themeColor: '#2563EB',
      routeUrl: '/apps/projects',
      requiresLicense: false,
      isActive: true,
      availableRoles: [
        'Project Lead',
        'Scrum Master',
        'Senior Developer',
        'QA Engineer',
        'Contributor',
        'Viewer',
      ],
    },
    {
      id: 'app-hrm',
      name: 'In2HRM',
      slug: 'hr-management',
      category: 'Human Resources',
      description: 'Staff directory, talent onboarding, payroll processing, and benefits compliance.',
      iconName: 'HR',
      themeColor: '#7C3AED',
      routeUrl: '/apps/hrm',
      requiresLicense: false,
      isActive: true,
      availableRoles: [
        'HR Director',
        'People Partner',
        'Payroll Administrator',
        'Recruiter',
        'Staff',
      ],
    },
    {
      id: 'app-leave',
      name: 'In2Leave',
      slug: 'leave-mgmt',
      category: 'Attendance & Leave',
      description: 'Leave balance management, vacation approvals, and calendar synchronization.',
      iconName: 'Leave',
      themeColor: '#059669',
      routeUrl: '/apps/leave',
      requiresLicense: false,
      isActive: true,
      availableRoles: [
        'Leave Approver / HOD',
        'HR Reviewer',
        'Staff / Requester',
      ],
    },
    {
      id: 'app-fin',
      name: 'In2Finance',
      slug: 'finance',
      category: 'Finance & Fiscal',
      description: 'Double-entry general ledger, invoicing, audit trails, and expense approval.',
      iconName: 'Finance',
      themeColor: '#D97706',
      routeUrl: '/apps/finance',
      requiresLicense: true,
      isActive: true,
      availableRoles: [
        'Finance Controller',
        'Chief Accountant',
        'Auditor',
        'Billing Officer',
        'Viewer',
      ],
    },
  ]);

  // New Application Registration Form
  const [newAppForm, setNewAppForm] = useState({
    name: '',
    slug: '',
    category: 'Operations',
    description: '',
    themeColor: '#0284C7',
    routeUrl: '',
    requiresLicense: false,
    rolesString: 'Lead, Member, Viewer',
  });

  // User Provisioning / Edit Form State
  const [userForm, setUserForm] = useState({
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
      'project-mgmt': 'Contributor',
      'hr-management': 'Staff',
      'leave-mgmt': 'Staff / Requester',
      finance: 'Viewer',
    } as Record<string, string>,
    aiAssistantEnabled: true,
    aiAssistantScope: 'pipeline_insights',
  });

  // AI Assistant Tab State
  const [aiModel, setAiModel] = useState('In2IT Converged Intelligence v2.0 (Gemini 1.5 Grounded)');
  const [aiAppToggles, setAiAppToggles] = useState<Record<string, boolean>>({
    in2crm: true,
    'project-mgmt': true,
    'hr-management': false,
    'leave-mgmt': true,
    finance: false,
  });
  const [aiTestPrompt, setAiTestPrompt] = useState('');
  const [aiTestResponse, setAiTestResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Email Templates State
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('welcome');
  const [emailTemplates, setEmailTemplates] = useState({
    welcome: {
      title: 'New Employee Onboarding & Application Access Dispatch',
      subject: 'Welcome to In2IT EBS — Your In2ERP Credentials & Application Access',
      body: `Dear {{employee_name}},\n\nWelcome to In2IT EBS! Your central corporate account has been provisioned by the Administrator.\n\nYou have been granted access to the following ERP Applications:\n{{assigned_apps_list}}\n\nYou can access your personalized launchpad using the corporate single sign-on link below:\n{{login_url}}\n\nPrimary System Role: {{primary_role}}\nDesignation: {{designation}} - {{department}}\n\nWarm regards,\nIn2IT ERP Enterprise Administration`,
    },
    role_change: {
      title: 'Application Scoped Role Modified by Administrator',
      subject: 'Security Notice: Your In2ERP Application Access Privileges Have Been Updated',
      body: `Dear {{employee_name}},\n\nThis is an automated notification from In2ERP Security & Administration.\n\nYour application-specific role assignments have been modified by the Administrator:\n{{assigned_apps_list}}\n\nIf you did not request or anticipate this change, please contact the IT Security Desk immediately.\n\nBest regards,\nIn2IT Security & Governance`,
    },
    password_reset: {
      title: 'Password Reset & Multi-Factor Auth Dispatch',
      subject: 'In2ERP Account Password Reset Request',
      body: `Hello {{employee_name}},\n\nA password reset request was initiated for your official account ({{employee_email}}).\n\nPlease click the secure link below to establish new credentials. This link expires in 15 minutes.\n{{reset_url}}\n\nIn2IT Identity & Access Management`,
    },
  });

  // Notifications State
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    targetApp: 'all',
    message: '',
    urgency: 'info',
  });
  const [sentNotifications, setSentNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Scheduled System Maintenance: Q4 Fiscal Year Close',
      target: 'All ERP Modules',
      urgency: 'warning',
      timestamp: '27 Oct 2026, 09:30 IST',
      sentBy: 'Administrator',
    },
    {
      id: 'notif-2',
      title: 'In2CRM Pipeline Governance Rules Updated',
      target: 'In2CRM Users',
      urgency: 'info',
      timestamp: '26 Oct 2026, 16:45 IST',
      sentBy: 'Administrator',
    },
  ]);

  // Data Scopes State (Screenshot 5 Match)
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

      // Merge backend applications if any extra exist
      if (appsData && appsData.length > 0) {
        setRegisteredApps((prev) => {
          const existingSlugs = new Set(prev.map((p) => p.slug));
          const additions: RegisteredApp[] = [];
          for (const a of appsData) {
            if (!existingSlugs.has(a.slug)) {
              additions.push({
                id: a.id,
                name: a.name,
                slug: a.slug,
                category: a.category || 'Operations',
                description: a.description || 'Enterprise module',
                iconName: 'Grid',
                themeColor: '#0284C7',
                routeUrl: a.url || `/apps/${a.slug}`,
                requiresLicense: a.requires_license || false,
                isActive: a.is_active ?? true,
                availableRoles: ['Manager', 'Member', 'Viewer'],
              });
            }
          }
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
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

  // Open Create User Modal
  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserForm({
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
        'project-mgmt': 'Contributor',
        'hr-management': 'Staff',
        'leave-mgmt': 'Staff / Requester',
        finance: 'Viewer',
      },
      aiAssistantEnabled: true,
      aiAssistantScope: 'pipeline_insights',
    });
    setIsAddUserOpen(true);
  };

  // Open Edit User Modal
  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    // Find assigned apps from user object if available or sensible defaults
    const currentApps = (u as any).assigned_apps || ['in2crm'];
    const currentRoles: Record<string, string> = {};
    registeredApps.forEach((a) => {
      currentRoles[a.slug] = (u as any).app_roles?.[a.slug] || a.availableRoles[0] || 'Member';
    });

    setUserForm({
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      department: u.department || 'Sales',
      designation: u.designation || 'Specialist',
      phone: u.phone || '',
      role: u.designation || 'Sales Manager',
      assignedApps: currentApps,
      appRoles: currentRoles,
      aiAssistantEnabled: true,
      aiAssistantScope: 'pipeline_insights',
    });
    setIsAddUserOpen(true);
  };

  // Submit Create or Edit User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email || !userForm.firstName || !userForm.lastName) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      if (editingUser) {
        // Update user
        await userService.updateUser(editingUser.id, {
          first_name: userForm.firstName,
          last_name: userForm.lastName,
          department: userForm.department,
          designation: userForm.designation,
          phone: userForm.phone,
        });
        showToast(`Employee ${userForm.firstName} ${userForm.lastName} updated with ${userForm.assignedApps.length} application access grants.`);
      } else {
        // Create user
        await userService.createUser({
          email: userForm.email,
          password: 'password123',
          first_name: userForm.firstName,
          last_name: userForm.lastName,
          department: userForm.department,
          designation: userForm.designation,
          phone: userForm.phone,
        });
        showToast(`Employee ${userForm.firstName} ${userForm.lastName} provisioned with custom application roles.`);
      }

      setIsAddUserOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save employee.');
    }
  };

  // Register New Application
  const handleRegisterApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppForm.name || !newAppForm.slug) {
      alert('Please specify Application Name and Slug.');
      return;
    }

    const parsedRoles = newAppForm.rolesString
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const newApp: RegisteredApp = {
      id: `app-custom-${Date.now()}`,
      name: newAppForm.name,
      slug: newAppForm.slug.toLowerCase().replace(/\s+/g, '-'),
      category: newAppForm.category,
      description: newAppForm.description || 'Custom ERP module developed for In2IT enterprise.',
      iconName: 'Grid',
      themeColor: newAppForm.themeColor,
      routeUrl: newAppForm.routeUrl || `/apps/${newAppForm.slug}`,
      requiresLicense: newAppForm.requiresLicense,
      isActive: true,
      availableRoles: parsedRoles.length > 0 ? parsedRoles : ['Lead', 'Member', 'Viewer'],
    };

    setRegisteredApps([...registeredApps, newApp]);
    // Also enable in AI toggles
    setAiAppToggles((prev) => ({ ...prev, [newApp.slug]: true }));

    showToast(`Application "${newApp.name}" registered. Admin can now assign it to employees.`);
    setIsRegisterAppOpen(false);
    setNewAppForm({
      name: '',
      slug: '',
      category: 'Operations',
      description: '',
      themeColor: '#0284C7',
      routeUrl: '',
      requiresLicense: false,
      rolesString: 'Lead, Member, Viewer',
    });
  };

  // Add custom role to an application
  const handleAddRoleToApp = () => {
    if (!managingRolesApp || !newRoleInput.trim()) return;
    const roleToAdd = newRoleInput.trim();
    if (managingRolesApp.availableRoles.includes(roleToAdd)) {
      alert('Role already exists for this application.');
      return;
    }

    const updatedRoles = [...managingRolesApp.availableRoles, roleToAdd];
    setRegisteredApps(
      registeredApps.map((a) =>
        a.id === managingRolesApp.id ? { ...a, availableRoles: updatedRoles } : a
      )
    );
    setManagingRolesApp({ ...managingRolesApp, availableRoles: updatedRoles });
    setNewRoleInput('');
    showToast(`Role "${roleToAdd}" added to ${managingRolesApp.name}.`);
  };

  // Send Broadcast Notification
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) {
      alert('Please fill in notification title and message.');
      return;
    }

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: broadcastForm.title,
      target: broadcastForm.targetApp === 'all' ? 'All ERP Modules' : broadcastForm.targetApp,
      urgency: broadcastForm.urgency,
      timestamp: 'Just now • 27 Oct 2026',
      sentBy: 'Administrator',
    };

    setSentNotifications([newNotif, ...sentNotifications]);
    showToast(`Broadcast "${broadcastForm.title}" dispatched across target ERP applications.`);
    setBroadcastForm({ title: '', targetApp: 'all', message: '', urgency: 'info' });
  };

  // Run AI Test Prompt
  const handleRunAiPrompt = () => {
    if (!aiTestPrompt.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      setAiTestResponse(
        `[In2IT Converged AI Copilot]: Grounded in active enterprise context across In2CRM and In2Projects:\n- 14 active deals in pipeline valued at $1,420,000.\n- 6 deals are in Final Negotiation (82% close probability).\n- In2Projects milestone #4 is on track with 94% sprint velocity.\nRecommendation: Administrator can allocate 2 additional developers to In2Projects to expedite Q4 delivery.`
      );
      setAiLoading(false);
    }, 600);
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
          1. LEFT SIDEBAR (Dark Navy #121E3B - In2ERP Admin Console)
      ───────────────────────────────────────────────────────────── */}
      <aside className="master-sidebar">
        {/* Top Logo & Launchpad return */}
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

        {/* Active Application Banner: In2ERP (Exact match to User Request) */}
        <div className="active-app-banner">
          <div className="app-banner-title">In2ERP</div>
          <div className="app-banner-sub">Enterprise Administration & Governance</div>
        </div>

        {/* Clean Admin Navigation Tree */}
        <nav className="master-nav-tree">
          {/* CONFIGURE & GOVERNANCE */}
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
              <span className="sidebar-count-badge">{registeredApps.length}</span>
            </div>
            <div
              className={`nav-tree-item ${activeTab === 'master_lists' ? 'active-plum-nav' : ''}`}
              onClick={() => setActiveTab('master_lists')}
            >
              <Sliders size={16} />
              <span>Master Lists</span>
            </div>
          </div>

          {/* INTELLIGENCE & AUTOMATION */}
          <div className="nav-group">
            <div className="nav-group-header">INTELLIGENCE & AUTOMATION</div>
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

        {/* Sidebar Footer: Return to Launchpad */}
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
            <button
              className="header-icon-badge"
              onClick={() => setActiveTab('notifications')}
              title="System Notifications"
            >
              <Bell size={18} color="#64748B" />
            </button>

            {/* Admin Avatar */}
            <div className="header-admin-avatar" title={user?.email || 'Administrator'}>
              <span>{user ? `${user.first_name[0] || 'S'}${user.last_name[0] || 'A'}` : 'SA'}</span>
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            EXACT 7 CATEGORY TABS (User Requested List Only)
            Users & access | Roles & permissions | Applications & Registry | Master lists | AI assistant | Email templates | Notifications
        ───────────────────────────────────────────────────────────── */}
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
            className={`category-tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            Applications & Registry
          </button>
          <button
            className={`category-tab-btn ${activeTab === 'master_lists' ? 'active' : ''}`}
            onClick={() => setActiveTab('master_lists')}
          >
            Master lists
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
            3. TAB CONTENT AREA
        ───────────────────────────────────────────────────────────── */}
        <div className="master-tab-content-area">
          {/* ════════════════════════════════════════════════════════════
              TAB 1: Users & access (Screenshot 1)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  {filteredUsers.length} USERS • Enterprise Employee Directory
                </div>
                <button className="btn-plum-action" onClick={openCreateUserModal}>
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
                      <th>ASSIGNED APPLICATIONS</th>
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
                            <span className="role-lavender-badge">{roleDisplay}</span>
                          </td>
                          <td>
                            <span className="status-active-pill">Active</span>
                          </td>
                          <td>
                            <div className="user-apps-pill-stack">
                              <span className="app-micro-pill crm">In2CRM</span>
                              <span className="app-micro-pill proj">In2Projects</span>
                              <span className="app-micro-pill ai">AI Bot ✨</span>
                            </div>
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
                                onClick={() => openEditUserModal(u)}
                                title="Edit employee application access and roles"
                              >
                                <Edit2 size={14} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="table-action-btn"
                                onClick={() =>
                                  showToast(`Password reset link dispatched for ${u.email}`)
                                }
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
              {/* Secondary Sub-Tabs Pill Row */}
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
                    <div className="panel-count-label">Roles • {roles.length || 9}</div>
                    <button
                      className="btn-plum-action"
                      onClick={() => showToast('New System Role creation dialog')}
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
                          {
                            name: 'Administrator',
                            code: 'ADMIN',
                            desc: 'Full system access across all ERP applications, master data, and user governance.',
                            grants: 'ALL (*)',
                            users: 2,
                            isAll: true,
                          },
                          {
                            name: 'Chief Revenue Officer',
                            code: 'CRO',
                            desc: 'Owns the portfolio. Sees all deals, approves Go/No-Go, sets enterprise tiering.',
                            grants: '71 -1',
                            users: 2,
                          },
                          {
                            name: 'Salesperson',
                            code: 'SALES',
                            desc: 'Creates and works deals they own or are on the team for.',
                            grants: '69',
                            users: 1,
                          },
                          {
                            name: 'Sales Manager',
                            code: 'SALES_MANAGER',
                            desc: 'Leads sales team. Decides Prospect->Lead promotion. Team-scoped visibility.',
                            grants: '73',
                            users: 1,
                          },
                          {
                            name: 'Practice Lead',
                            code: 'PRACTICE_LEAD',
                            desc: 'Owns solutioning, resourcing, and tech delivery governance.',
                            grants: '64',
                            users: 2,
                          },
                          {
                            name: 'Finance Approver',
                            code: 'FINANCE',
                            desc: 'Decides Internal Finance Approval (GOV-08) and Ledger Review (PVT-06).',
                            grants: '61',
                            users: 1,
                          },
                          {
                            name: 'Read Only',
                            code: 'VIEWER',
                            desc: 'Reporting and compliance view access with no mutation capability.',
                            grants: '60',
                            users: 2,
                          },
                          {
                            name: 'Executive Chairman',
                            code: 'EXEC_CHAIRMAN',
                            desc: 'Board-level sign-off. High governance threshold signoff across all modules.',
                            grants: '63',
                            users: 1,
                          },
                          {
                            name: 'Project Manager',
                            code: 'PROJECT_MANAGER',
                            desc: 'Project delivery tracking, sprint allocation and milestone governance.',
                            grants: '65',
                            users: 1,
                          },
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
                      <span className="legend-item">
                        <span className="legend-dot green" /> Allow
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot red" /> Deny
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot purple" /> via *
                      </span>
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

                  {/* Matrix Table */}
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
                              <td className="matrix-cell">
                                <span className="dot-via-star">●</span>
                              </td>
                              <td className="matrix-cell">
                                {idx === 0 ? (
                                  <span className="icon-deny">✕</span>
                                ) : (
                                  <span className="icon-allow">✓</span>
                                )}
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
                              <td className="matrix-cell">
                                <span className="icon-allow">✓</span>
                              </td>
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
                      <strong>User Access</strong> • primary role + application overrides
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
                                <div className="cell-name-bold">
                                  {u.first_name} {u.last_name}
                                </div>
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
                                  onClick={() => openEditUserModal(u)}
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

                  {/* Informational Alert Box */}
                  <div className="data-scopes-alert-box">
                    <Shield size={18} color="#0284C7" />
                    <div>
                      <strong>Read</strong> controls which rows a role can see; <strong>Write</strong> which it can edit. Scope widens: <code>own ⊂ practice ⊂ team ⊂ all</code>.
                    </div>
                  </div>

                  {/* Data Scopes Table */}
                  <div className="master-data-table-wrapper">
                    <table className="data-scopes-table">
                      <thead>
                        <tr className="header-grouped-row">
                          <th rowSpan={2}>ROLE</th>
                          <th colSpan={2} className="group-col-header">
                            DEAL / LEAD
                          </th>
                          <th colSpan={2} className="group-col-header">
                            ACCOUNT / CONTACT
                          </th>
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

              {/* Sub-Tabs: Audit Log */}
              {rolesSubTab === 'audit_log' && (
                <div className="audit-subtab-view">
                  <div className="panel-count-label">
                    Security Audit Trail • Immutable Access Log
                  </div>
                  <div className="audit-timeline-feed">
                    <div className="audit-item">
                      <div className="audit-dot" />
                      <div>
                        <strong>Application Scope Updated</strong>: <em>Administrator</em> modified roles on <code>In2CRM</code> and <code>In2Projects</code>
                        <div className="audit-time">27 Oct 2026, 10:45 IST • Admin Console</div>
                      </div>
                    </div>
                    <div className="audit-item">
                      <div className="audit-dot" />
                      <div>
                        <strong>User Provisioned</strong>: <em>Elisaya Nayak</em> with <code>Sales Manager</code> role on In2CRM
                        <div className="audit-time">27 Oct 2026, 07:04 IST • System Seed</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 3: Applications & Registry (Central ERP App Governance)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'applications' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>{registeredApps.length} Registered Enterprise Applications</strong> • Admin Application Registry & Roles
                </div>
                <button
                  className="btn-plum-action"
                  onClick={() => setIsRegisterAppOpen(true)}
                >
                  <Plus size={16} />
                  <span>Register Application</span>
                </button>
              </div>

              {/* Informational Banner */}
              <div className="app-registry-info-banner">
                <Layers size={18} color="#6B2144" />
                <div>
                  <strong>Admin Governance Notice:</strong> Only the Administrator can assign employees to these ERP applications and define their application-specific roles. Developers who build new internal apps can register them here, configure their scoped roles, and activate them across the ERP.
                </div>
              </div>

              {/* Applications Grid */}
              <div className="apps-registry-grid">
                {registeredApps.map((appItem) => (
                  <div key={appItem.id} className="app-registry-card">
                    <div className="app-card-top-row">
                      <div
                        className="app-card-badge-icon"
                        style={{ background: appItem.themeColor }}
                      >
                        <Layers size={22} color="#FFFFFF" />
                      </div>
                      <div className="app-card-title-group">
                        <div className="app-card-title">{appItem.name}</div>
                        <div className="app-card-slug">/{appItem.slug}</div>
                      </div>
                      <span className="app-category-badge">{appItem.category}</span>
                    </div>

                    <p className="app-card-description">{appItem.description}</p>

                    <div className="app-card-roles-section">
                      <div className="roles-header-row">
                        <span className="roles-title-label">
                          Configured Roles ({appItem.availableRoles.length}):
                        </span>
                        <button
                          className="btn-manage-app-roles"
                          onClick={() => setManagingRolesApp(appItem)}
                        >
                          <PlusCircle size={12} />
                          <span>Add Role</span>
                        </button>
                      </div>

                      <div className="app-roles-tag-list">
                        {appItem.availableRoles.map((rName, idx) => (
                          <span key={idx} className="app-role-tag">
                            {rName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="app-card-footer-info">
                      <div className="license-indicator">
                        {appItem.requiresLicense ? (
                          <span className="license-tag enterprise">Enterprise License</span>
                        ) : (
                          <span className="license-tag core">Core Included</span>
                        )}
                      </div>
                      <div className="status-indicator">
                        <span className="status-active-pill">● Active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 4: Master lists (Taxonomies, Departments, Currencies)
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
                    {[
                      'Sales',
                      'Engineering',
                      'Leadership',
                      'Finance',
                      'Human Resources',
                      'Operations',
                      'Audit & Legal',
                    ].map((d, i) => (
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
                    {[
                      'In2IT Bhubaneswar (HQ)',
                      'In2IT Bengaluru',
                      'In2IT UAE (Dubai)',
                      'In2IT UK (London)',
                      'In2IT Americas (New York)',
                    ].map((b, i) => (
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
              TAB 5: AI assistant (Model & Per-App Copilot Access)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai_assistant' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>AI Assistant & Chatbot Access Governance</strong>
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
                      Enterprise-grounded generative intelligence for CRM pipelines, project velocity forecasting, and cross-application assistance.
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
                    Enable or disable the AI Assistant per registered application. When enabled, employees granted AI privileges can use the copilot within that application.
                  </p>

                  <div className="app-toggles-grid">
                    {registeredApps.map((appItem) => {
                      const isEnabled = aiAppToggles[appItem.slug] ?? false;
                      return (
                        <div
                          key={appItem.slug}
                          className={`app-toggle-card ${isEnabled ? 'enabled' : ''}`}
                        >
                          <div className="toggle-card-header">
                            <div>
                              <h5>{appItem.name}</h5>
                              <span className="app-toggle-desc">{appItem.description}</span>
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
                        placeholder="Ask In2IT Copilot: e.g., 'Summarize active deals in negotiation and sprint risks'..."
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
                        <div className="response-text" style={{ whiteSpace: 'pre-line' }}>
                          {aiTestResponse}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 6: Email templates (Onboarding & Access Dispatch)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'email_templates' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>System Email Templates</strong> • Employee Provisioning & Alerts
                </div>
              </div>

              <div className="email-templates-layout">
                {/* Template Selector Sidebar */}
                <div className="template-selector-list">
                  <div
                    className={`template-selector-item ${selectedTemplateKey === 'welcome' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplateKey('welcome')}
                  >
                    <Mail size={16} />
                    <div>
                      <div className="template-item-name">Employee Onboarding</div>
                      <div className="template-item-sub">Access & Application Grant</div>
                    </div>
                  </div>

                  <div
                    className={`template-selector-item ${selectedTemplateKey === 'role_change' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplateKey('role_change')}
                  >
                    <ShieldCheck size={16} />
                    <div>
                      <div className="template-item-name">Role Privileges Modified</div>
                      <div className="template-item-sub">Application Scope Alert</div>
                    </div>
                  </div>

                  <div
                    className={`template-selector-item ${selectedTemplateKey === 'password_reset' ? 'active' : ''}`}
                    onClick={() => setSelectedTemplateKey('password_reset')}
                  >
                    <Key size={16} />
                    <div>
                      <div className="template-item-name">Password Reset Link</div>
                      <div className="template-item-sub">Credentials Dispatch</div>
                    </div>
                  </div>
                </div>

                {/* Template Editor / Preview */}
                <div className="template-preview-panel">
                  {(() => {
                    const currentTpl = (emailTemplates as any)[selectedTemplateKey];
                    return (
                      <div>
                        <div className="template-preview-header">
                          <h4>{currentTpl.title}</h4>
                          <span className="template-variable-hint">
                            Variables: <code>{"{{employee_name}}"}</code>, <code>{"{{assigned_apps_list}}"}</code>, <code>{"{{login_url}}"}</code>
                          </span>
                        </div>

                        <div className="template-field-group">
                          <label>Email Subject:</label>
                          <input
                            type="text"
                            value={currentTpl.subject}
                            onChange={(e) =>
                              setEmailTemplates({
                                ...emailTemplates,
                                [selectedTemplateKey]: {
                                  ...currentTpl,
                                  subject: e.target.value,
                                },
                              })
                            }
                          />
                        </div>

                        <div className="template-field-group">
                          <label>Message Content:</label>
                          <textarea
                            rows={10}
                            value={currentTpl.body}
                            onChange={(e) =>
                              setEmailTemplates({
                                ...emailTemplates,
                                [selectedTemplateKey]: {
                                  ...currentTpl,
                                  body: e.target.value,
                                },
                              })
                            }
                          />
                        </div>

                        <div className="template-action-row">
                          <button
                            className="btn-plum-action"
                            onClick={() =>
                              showToast(`Template "${currentTpl.title}" saved successfully.`)
                            }
                          >
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
              TAB 7: Notifications (Announcements & Alerts)
          ════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="settings-card-panel">
              <div className="panel-top-action-bar">
                <div className="panel-count-label">
                  <strong>System Broadcasts & In2ERP Notifications</strong>
                </div>
              </div>

              <div className="notifications-container">
                {/* Send Broadcast Box */}
                <form onSubmit={handleSendBroadcast} className="broadcast-composer-card">
                  <h4 className="section-title">Dispatch System Announcement</h4>
                  <p className="section-desc">
                    Send an urgent notice, maintenance window alert, or application policy update to all employees or specific app users.
                  </p>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Announcement Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. In2CRM Q4 Close Maintenance Window"
                        value={broadcastForm.title}
                        onChange={(e) =>
                          setBroadcastForm({ ...broadcastForm, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Audience</label>
                      <select
                        value={broadcastForm.targetApp}
                        onChange={(e) =>
                          setBroadcastForm({ ...broadcastForm, targetApp: e.target.value })
                        }
                      >
                        <option value="all">All ERP Employees (Global)</option>
                        {registeredApps.map((a) => (
                          <option key={a.slug} value={a.name}>
                            {a.name} Users Only
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Broadcast Message *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Type your enterprise announcement message..."
                      value={broadcastForm.message}
                      onChange={(e) =>
                        setBroadcastForm({ ...broadcastForm, message: e.target.value })
                      }
                    />
                  </div>

                  <div className="broadcast-footer-row">
                    <button type="submit" className="btn-plum-action">
                      <Send size={15} />
                      <span>Dispatch Broadcast</span>
                    </button>
                  </div>
                </form>

                {/* Sent Notifications History */}
                <div className="notifications-history-card">
                  <h4 className="section-title">Recent Broadcast History</h4>
                  <div className="notif-history-list">
                    {sentNotifications.map((n) => (
                      <div key={n.id} className="notif-history-item">
                        <div className="notif-item-left">
                          <Bell size={18} color="#6B2144" />
                          <div>
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-sub">
                              Target: <strong>{n.target}</strong> • Dispatched by {n.sentBy}
                            </div>
                          </div>
                        </div>
                        <span className="notif-timestamp">{n.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: + ADD / EDIT USER (With Scoped Application Roles)
      ───────────────────────────────────────────────────────────── */}
      {isAddUserOpen && (
        <div className="master-modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingUser
                  ? `Edit Employee & Application Roles (${editingUser.first_name} ${editingUser.last_name})`
                  : 'Add New Employee & Provision Application Access'}
              </h2>
              <button className="modal-close-btn" onClick={() => setIsAddUserOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="modal-body-scrollable">
              {/* Section 1: Basic Identity */}
              <div className="form-section-title">1. Employee Personal & Corporate Identity</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
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
                    disabled={!!editingUser}
                    placeholder="e.g. john.doe@in2itebs.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Department</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
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
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                  />
                </div>
              </div>

              {/* Section 2: Primary ERP Security Role */}
              <div className="form-section-title">2. Primary ERP Security Role</div>
              <div className="form-group">
                <label>System Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
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

              {/* Section 3: Scoped Application Access (Dynamically rendered from registeredApps) */}
              <div className="form-section-title">
                3. Assign ERP Applications & Scoped Roles (Admin Granted Only)
              </div>
              <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                Only the administrator grants application launch rights and configures the employee's exact role per application.
              </p>

              <div className="app-assignments-provision-stack">
                {registeredApps.map((appOption) => {
                  const isChecked = userForm.assignedApps.includes(appOption.slug);
                  return (
                    <div
                      key={appOption.slug}
                      className={`provision-item ${isChecked ? 'selected' : ''}`}
                    >
                      <label className="checkbox-app-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserForm({
                                ...userForm,
                                assignedApps: [...userForm.assignedApps, appOption.slug],
                              });
                            } else {
                              setUserForm({
                                ...userForm,
                                assignedApps: userForm.assignedApps.filter(
                                  (s) => s !== appOption.slug
                                ),
                              });
                            }
                          }}
                        />
                        <span className="app-name-strong">{appOption.name}</span>
                        <span className="app-category-mini">({appOption.category})</span>
                      </label>

                      {isChecked && (
                        <div className="app-role-select-box">
                          <label>Role in {appOption.name}:</label>
                          <select
                            value={
                              userForm.appRoles[appOption.slug] || appOption.availableRoles[0]
                            }
                            onChange={(e) =>
                              setUserForm({
                                ...userForm,
                                appRoles: {
                                  ...userForm.appRoles,
                                  [appOption.slug]: e.target.value,
                                },
                              })
                            }
                          >
                            {appOption.availableRoles.map((r) => (
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
                    checked={userForm.aiAssistantEnabled}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        aiAssistantEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>Enable In2IT AI Copilot & Chatbot for this Employee</span>
                </label>

                {userForm.aiAssistantEnabled && (
                  <div className="ai-scope-selector" style={{ marginTop: 10 }}>
                    <label>AI Assistant Permission Level:</label>
                    <select
                      value={userForm.aiAssistantScope}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          aiAssistantScope: e.target.value,
                        })
                      }
                    >
                      <option value="general_queries">General Queries & Document Lookup</option>
                      <option value="pipeline_insights">
                        Pipeline Insights & Forecasting (CRM/Projects)
                      </option>
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
                  {editingUser ? 'Update Employee Privileges' : 'Save & Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: + REGISTER NEW APPLICATION (For Future Development)
      ───────────────────────────────────────────────────────────── */}
      {isRegisterAppOpen && (
        <div className="master-modal-backdrop" onClick={() => setIsRegisterAppOpen(false)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New ERP Application / Module</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsRegisterAppOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterApplication} className="modal-body-scrollable">
              <p className="field-hint" style={{ marginBottom: 16 }}>
                Register newly developed internal applications into In2ERP. Once registered, the Administrator can assign roles and manage employee access.
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
                        slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Application Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. in2-supply-chain"
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
                    onChange={(e) =>
                      setNewAppForm({ ...newAppForm, category: e.target.value })
                    }
                  >
                    <option value="Operations">Operations & Supply</option>
                    <option value="Finance & Fiscal">Finance & Fiscal</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Productivity">Productivity & Collaboration</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Engineering">Engineering & DevOps</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Theme Color</label>
                  <input
                    type="color"
                    value={newAppForm.themeColor}
                    onChange={(e) =>
                      setNewAppForm({ ...newAppForm, themeColor: e.target.value })
                    }
                    style={{ height: 38, padding: 2 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Route URL / Launch Endpoint</label>
                <input
                  type="text"
                  placeholder="e.g. /apps/supply-chain"
                  value={newAppForm.routeUrl}
                  onChange={(e) =>
                    setNewAppForm({ ...newAppForm, routeUrl: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Defined Roles for this Application (comma separated) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supply Chain Lead, Warehouse Manager, Officer, Viewer"
                  value={newAppForm.rolesString}
                  onChange={(e) =>
                    setNewAppForm({ ...newAppForm, rolesString: e.target.value })
                  }
                />
                <span className="field-hint">
                  These roles will immediately be selectable when assigning employees to this application.
                </span>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the application's business function..."
                  value={newAppForm.description}
                  onChange={(e) =>
                    setNewAppForm({ ...newAppForm, description: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label className="toggle-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newAppForm.requiresLicense}
                    onChange={(e) =>
                      setNewAppForm({ ...newAppForm, requiresLicense: e.target.checked })
                    }
                  />
                  <span>Requires Enterprise Tier License</span>
                </label>
              </div>

              <div className="modal-form-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsRegisterAppOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-plum-action">
                  Register Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: MANAGE APPLICATION ROLES
      ───────────────────────────────────────────────────────────── */}
      {managingRolesApp && (
        <div className="master-modal-backdrop" onClick={() => setManagingRolesApp(null)}>
          <div className="master-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Roles for {managingRolesApp.name}</h2>
              <button className="modal-close-btn" onClick={() => setManagingRolesApp(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              <p className="field-hint">
                These roles govern the specific access level employees hold inside <strong>{managingRolesApp.name}</strong>.
              </p>

              <div className="manage-roles-stack">
                {managingRolesApp.availableRoles.map((r, i) => (
                  <div key={i} className="app-role-entry-row">
                    <span className="role-index-number">#{i + 1}</span>
                    <span className="role-entry-name">{r}</span>
                    <span className="role-active-indicator">Configured</span>
                  </div>
                ))}
              </div>

              <div className="add-role-input-row" style={{ marginTop: 18 }}>
                <input
                  type="text"
                  placeholder="Enter new role name (e.g. Presales Lead)..."
                  value={newRoleInput}
                  onChange={(e) => setNewRoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoleToApp()}
                />
                <button className="btn-plum-action" onClick={handleAddRoleToApp}>
                  <Plus size={15} />
                  <span>Add Role</span>
                </button>
              </div>
            </div>

            <div className="modal-form-footer">
              <button
                className="btn-plum-action"
                onClick={() => setManagingRolesApp(null)}
              >
                Done
              </button>
            </div>
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
