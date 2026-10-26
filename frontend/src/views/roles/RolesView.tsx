import React, { useEffect, useState } from 'react';
import { roleService } from '@/services/roleService';
import { userService } from '@/services/userService';
import { Role, Permission, User, RoleCreatePayload } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useNotification } from '@/stores/NotificationContext';
import { useAuth } from '@/stores/AuthContext';
import {
  ShieldCheck,
  Plus,
  Lock,
  Edit2,
  Trash2,
  Check,
  UserPlus,
  Sliders,
} from 'lucide-react';

export const RolesView: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // Form states for role creation/editing
  const [roleForm, setRoleForm] = useState<RoleCreatePayload>({
    name: '',
    description: '',
    color: '#6366F1',
    permission_ids: [],
  });

  // Per-user override form state
  const [overrideUser, setOverrideUser] = useState<string>('');
  const [overridePermission, setOverridePermission] = useState<string>('');
  const [overrideIsGranted, setOverrideIsGranted] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const { success, error } = useNotification();
  const { hasPermission } = useAuth();

  const fetchData = async () => {
    try {
      const [roleList, permList, userResp] = await Promise.all([
        roleService.listRoles(),
        roleService.listPermissions(),
        userService.listUsers({ per_page: 50 }),
      ]);
      setRoles(roleList);
      setPermissions(permList);
      setUsers(userResp.users);
    } catch (err: any) {
      error(err.message || 'Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      color: '#6366F1',
      permission_ids: [],
    });
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: Role) => {
    setEditingRole(role);
    const assignedIds = role.permissions?.map((p) => p.id) || [];
    setRoleForm({
      name: role.name,
      description: role.description || '',
      color: role.color || '#6366F1',
      permission_ids: assignedIds,
    });
    setIsRoleModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    const current = roleForm.permission_ids || [];
    if (current.includes(permId)) {
      setRoleForm({ ...roleForm, permission_ids: current.filter((id) => id !== permId) });
    } else {
      setRoleForm({ ...roleForm, permission_ids: [...current, permId] });
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await roleService.updateRole(editingRole.id, roleForm);
        success('Role updated');
      } else {
        await roleService.createRole(roleForm);
        success('Custom role created');
      }
      setIsRoleModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save role');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await roleService.deleteRole(role.id);
      success('Role deleted');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete role');
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideUser || !overridePermission) {
      error('Please select both an employee and a permission');
      return;
    }

    try {
      await roleService.setPermissionOverride(
        overrideUser,
        overridePermission,
        overrideIsGranted,
        overrideReason || undefined
      );
      success('User permission override established');
      setIsOverrideModalOpen(false);
      setOverrideReason('');
    } catch (err: any) {
      error(err.message || 'Failed to set permission override');
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    acc[p.module] = acc[p.module] || [];
    acc[p.module].push(p);
    return acc;
  }, {});

  if (loading) return <LoadingSpinner message="Loading RBAC configuration..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles & Access Control (RBAC)</h1>
          <p className="page-subtitle">
            Configure system roles, granular permissions, and individual employee overrides
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {hasPermission('roles.override') && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (users.length > 0) setOverrideUser(users[0].id);
                if (permissions.length > 0) setOverridePermission(permissions[0].id);
                setIsOverrideModalOpen(true);
              }}
            >
              <Sliders size={16} />
              <span>Permission Override</span>
            </button>
          )}
          {hasPermission('roles.create') && (
            <button className="btn btn-primary" onClick={handleOpenCreateRole}>
              <Plus size={18} />
              <span>Create Custom Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="apps-grid" style={{ marginBottom: 36 }}>
        {roles.map((role) => {
          const permCount = role.permissions?.length || 0;
          return (
            <div key={role.id} className="app-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: role.color || 'var(--primary)',
                      }}
                    />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{role.name}</h3>
                  </div>
                  {role.is_system && (
                    <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lock size={12} />
                      <span>System</span>
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  {role.description || 'Custom organizational role.'}
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{role.user_count || 0} Employees Assigned</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {permCount} Permissions
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenEditRole(role)}
                  >
                    <Edit2 size={13} />
                    <span>View / Edit Matrix</span>
                  </button>
                  {!role.is_system && hasPermission('roles.delete') && (
                    <button
                      className="btn-icon"
                      title="Delete role"
                      onClick={() => handleDeleteRole(role)}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Edit/Create Modal with Matrix Checklist */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
        maxWidth="720px"
      >
        <form onSubmit={handleSaveRole}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  disabled={editingRole?.is_system}
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. Finance Auditor"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Badge Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    style={{ width: 42, height: 42, border: 'none', cursor: 'pointer', borderRadius: 8 }}
                    value={roleForm.color || '#6366F1'}
                    onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={roleForm.color || ''}
                    onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={2}
                disabled={editingRole?.is_system}
                value={roleForm.description || ''}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Scope and purpose of this role..."
              />
            </div>

            {/* Permissions Matrix */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  Granular Permission Matrix
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Selected: {roleForm.permission_ids?.length || 0} / {permissions.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(permissionsByModule).map(([module, perms]) => (
                  <div
                    key={module}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      background: '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--primary)',
                        marginBottom: 10,
                      }}
                    >
                      {module.toUpperCase()} MODULE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                      {perms.map((p) => {
                        const isChecked = roleForm.permission_ids?.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: '0.85rem',
                              cursor: editingRole?.is_system ? 'default' : 'pointer',
                              background: 'white',
                              padding: '8px 10px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={editingRole?.is_system}
                              onChange={() => togglePermission(p.id)}
                            />
                            <span>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsRoleModalOpen(false)}>
              Cancel
            </button>
            {!editingRole?.is_system && (
              <button type="submit" className="btn btn-primary">
                {editingRole ? 'Save Role Matrix' : 'Create Custom Role'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Per-User Permission Override Modal */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title="Per-User Permission Override"
      >
        <form onSubmit={handleSaveOverride}>
          <div className="modal-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Overrides grant or deny individual capabilities regardless of the employee's assigned roles.
            </p>

            <div className="form-group">
              <label className="form-label">Select Employee</label>
              <select
                className="form-control"
                value={overrideUser}
                onChange={(e) => setOverrideUser(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Permission</label>
              <select
                className="form-control"
                value={overridePermission}
                onChange={(e) => setOverridePermission(e.target.value)}
              >
                {permissions.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.module}] {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Override Policy</label>
              <select
                className="form-control"
                value={overrideIsGranted ? 'grant' : 'deny'}
                onChange={(e) => setOverrideIsGranted(e.target.value === 'grant')}
              >
                <option value="grant">Explicit Grant (Grant even without role)</option>
                <option value="deny">Explicit Deny (Revoke even if role provides it)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Audit Justification / Reason</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Temporary incident review authorization"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsOverrideModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Apply Override
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
