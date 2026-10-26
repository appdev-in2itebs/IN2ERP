import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import {
  LayoutDashboard,
  Users,
  Grid,
  ShieldCheck,
  UserCheck,
  History,
  LogOut,
  Building2,
} from 'lucide-react';

import { In2ITMark } from '@/components/In2ITMark';

export const Sidebar: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const isEmployeeOnly = !user?.is_superadmin && !hasPermission('employees.read');

  const navItems = [
    {
      label: isEmployeeOnly ? 'My Workspace' : 'Dashboard',
      path: '/',
      icon: <LayoutDashboard size={19} />,
      permission: 'dashboard.read',
    },
    {
      label: isEmployeeOnly ? 'My Applications' : 'Applications',
      path: '/applications',
      icon: <Grid size={19} />,
      permission: 'applications.read',
    },
    {
      label: 'Employees',
      path: '/employees',
      icon: <Users size={19} />,
      permission: 'employees.read',
    },
    {
      label: 'Roles & RBAC',
      path: '/roles',
      icon: <ShieldCheck size={19} />,
      permission: 'roles.read',
    },
    {
      label: 'Assignments',
      path: '/assignments',
      icon: <UserCheck size={19} />,
      permission: 'assignments.read',
    },
    {
      label: 'Audit Logs',
      path: '/audit',
      icon: <History size={19} />,
      permission: 'audit.read',
    },
  ];

  const visibleNav = navItems.filter((item) => !item.permission || hasPermission(item.permission));

  const initials = user
    ? `${user.first_name[0] || ''}${user.last_name[0] || ''}`.toUpperCase()
    : 'U';

  const roleName = user?.is_superadmin
    ? 'Super Admin'
    : user?.roles?.[0]?.name || 'Employee';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #1A2B52 0%, #0B1328 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}
        >
          <In2ITMark size={24} color="#94B8D0" />
        </div>
        <div>
          <span className="brand-title">In2IT ERP</span>
          <div style={{ fontSize: '0.68rem', color: '#94B8D0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            CONVERGED INTELLIGENCE
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">
          {isEmployeeOnly ? 'Employee Portal' : 'Core Management'}
        </div>
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="sidebar-user">
          <div className="user-meta">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-info-name">
                {user.first_name} {user.last_name}
              </div>
              <div className="user-info-role">{roleName}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-icon"
            title="Log out"
            style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
};
