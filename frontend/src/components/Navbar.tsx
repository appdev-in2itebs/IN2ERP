import React from 'react';
import { useAuth } from '@/stores/AuthContext';
import { Bell, Shield, Database } from 'lucide-react';

export const Navbar: React.FC<{ title?: string }> = ({ title = 'Management Portal' }) => {
  const { user } = useAuth();

  return (
    <header className="top-navbar">
      <div className="navbar-breadcrumbs">
        <span>In2IT ERP</span>
        <span>/</span>
        <span className="breadcrumb-active">{title}</span>
      </div>

      <div className="navbar-actions">
        {/* Database indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            padding: '4px 10px',
            borderRadius: 9999,
            background: '#f1f5f9',
            color: '#475569',
            fontWeight: 600,
          }}
        >
          <Database size={14} color="#6366f1" />
          <span>SQLite Mode (Migration-Ready)</span>
        </div>

        {/* Security badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            padding: '4px 10px',
            borderRadius: 9999,
            background: '#ecfdf5',
            color: '#065f46',
            fontWeight: 600,
            border: '1px solid #a7f3d0',
          }}
        >
          <Shield size={14} color="#10b981" />
          <span>RBAC Protected</span>
        </div>

        <button className="btn-icon" title="Notifications">
          <Bell size={18} />
        </button>

        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          {user ? user.first_name[0] : 'A'}
        </div>
      </div>
    </header>
  );
};
