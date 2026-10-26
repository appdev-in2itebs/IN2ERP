import React, { useEffect, useState } from 'react';
import { userService } from '@/services/userService';
import { roleService } from '@/services/roleService';
import { User, Role, UserCreatePayload, UserUpdatePayload } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useNotification } from '@/stores/NotificationContext';
import { useAuth } from '@/stores/AuthContext';
import {
  Users,
  Plus,
  Search,
  Building,
  Edit2,
  Trash2,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<string>('');

  // Form states
  const [createForm, setCreateForm] = useState<UserCreatePayload>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    department: 'Engineering',
    designation: 'Software Engineer',
    phone: '',
  });

  const [editForm, setEditForm] = useState<UserUpdatePayload>({
    first_name: '',
    last_name: '',
    department: '',
    designation: '',
    phone: '',
    is_active: true,
  });

  const { success, error } = useNotification();
  const { hasPermission } = useAuth();

  const fetchUsers = async () => {
    try {
      const data = await userService.listUsers({
        page,
        per_page: 15,
        search: search || undefined,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: any) {
      error(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [deptList, roleList] = await Promise.all([
        userService.getDepartments(),
        roleService.listRoles(),
      ]);
      setDepartments(deptList);
      setRoles(roleList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, search, departmentFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userService.createUser(createForm);
      success('Employee profile created successfully');
      setIsCreateOpen(false);
      setCreateForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        department: 'Engineering',
        designation: 'Software Engineer',
        phone: '',
      });
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to create employee');
    }
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name,
      last_name: u.last_name,
      department: u.department || '',
      designation: u.designation || '',
      phone: u.phone || '',
      is_active: u.is_active,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await userService.updateUser(editingUser.id, editForm);
      success('Employee details updated');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to update employee');
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Are you sure you want to remove ${u.first_name} ${u.last_name}?`)) return;
    try {
      await userService.deleteUser(u.id);
      success('Employee removed');
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to delete employee');
    }
  };

  const handleAssignRole = async () => {
    if (!roleModalUser || !selectedRoleToAssign) return;
    try {
      await roleService.assignRoleToUser(roleModalUser.id, selectedRoleToAssign);
      success('Role assigned to employee');
      setRoleModalUser(null);
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to assign role');
    }
  };

  const handleUnassignRole = async (userId: string, roleId: string) => {
    try {
      await roleService.unassignRoleFromUser(userId, roleId);
      success('Role unassigned');
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to unassign role');
    }
  };

  if (loading) return <LoadingSpinner message="Loading employee directory..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Directory</h1>
          <p className="page-subtitle">
            Enterprise staff directory, identity lifecycle, and role mappings
          </p>
        </div>
        {hasPermission('employees.create') && (
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={18} />
            <span>Add New Employee</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="table-card" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: 260 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name or email address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Building size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Department:
            </span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department & Role</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const initials = `${u.first_name[0] || ''}${u.last_name[0] || ''}`.toUpperCase();
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'var(--accent-gradient)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {u.first_name} {u.last_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.department || 'General'}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {u.is_superadmin ? (
                            <span className="badge badge-danger">Super Admin</span>
                          ) : (
                            u.roles?.map((r) => (
                              <span
                                key={r.id}
                                className="badge badge-primary"
                                style={{ background: r.color ? `${r.color}20` : undefined, color: r.color || undefined }}
                              >
                                {r.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </td>

                    <td>{u.designation || 'Staff'}</td>

                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {hasPermission('roles.assign') && (
                          <button
                            className="btn-icon"
                            title="Assign Roles"
                            onClick={() => {
                              setRoleModalUser(u);
                              setSelectedRoleToAssign(roles[0]?.id || '');
                            }}
                          >
                            <Shield size={15} />
                          </button>
                        )}
                        {hasPermission('employees.update') && (
                          <button
                            className="btn-icon"
                            title="Edit details"
                            onClick={() => handleOpenEdit(u)}
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {hasPermission('employees.delete') && !u.is_superadmin && (
                          <button
                            className="btn-icon"
                            title="Remove employee"
                            onClick={() => handleDelete(u)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No employees found matching the specified filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>Showing {users.length} of {total} employees</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page * 15 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Employee"
      >
        <form onSubmit={handleCreate}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Corporate Email</label>
              <input
                type="email"
                className="form-control"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input
                type="password"
                className="form-control"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-control"
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={createForm.designation}
                  onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Employee Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit Employee Information"
      >
        <form onSubmit={handleSaveEdit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.designation || ''}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Account Status</label>
              <select
                className="form-control"
                value={editForm.is_active ? 'active' : 'inactive'}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
              >
                <option value="active">Active (Full Access)</option>
                <option value="inactive">Inactive (Deactivated)</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Role Assignment Modal */}
      <Modal
        isOpen={!!roleModalUser}
        onClose={() => setRoleModalUser(null)}
        title={`Assign Roles: ${roleModalUser?.first_name} ${roleModalUser?.last_name}`}
      >
        <div className="modal-body">
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Select a system or custom role to grant to this employee.
          </p>
          <div className="form-group">
            <label className="form-label">Select Role to Grant</label>
            <select
              className="form-control"
              value={selectedRoleToAssign}
              onChange={(e) => setSelectedRoleToAssign(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.description}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 8 }}>
              Currently Assigned Roles:
            </h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {roleModalUser?.roles?.length ? (
                roleModalUser.roles.map((r) => (
                  <span
                    key={r.id}
                    className="badge badge-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>{r.name}</span>
                    <button
                      onClick={() => handleUnassignRole(roleModalUser.id, r.id)}
                      style={{ background: 'none', border: 'none', color: '#4338ca', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  No roles directly assigned.
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setRoleModalUser(null)}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={handleAssignRole}>
            Assign Role
          </button>
        </div>
      </Modal>
    </div>
  );
};
