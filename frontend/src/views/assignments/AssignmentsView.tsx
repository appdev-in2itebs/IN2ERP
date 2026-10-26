import React, { useEffect, useState } from 'react';
import { assignmentService } from '@/services/assignmentService';
import { userService } from '@/services/userService';
import { applicationService } from '@/services/applicationService';
import { Assignment, User, Application, AssignmentCreatePayload } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useNotification } from '@/stores/NotificationContext';
import { useAuth } from '@/stores/AuthContext';
import {
  UserCheck,
  Plus,
  Search,
  Grid,
  Trash2,
  Calendar,
  FileText,
  AlertCircle,
  Shield,
  Edit2,
} from 'lucide-react';

export const AssignmentsView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editAppRole, setEditAppRole] = useState('Member');

  const [createForm, setCreateForm] = useState<AssignmentCreatePayload>({
    user_id: '',
    application_id: '',
    app_role: 'Project Lead',
    notes: '',
    expires_at: null,
  });

  const { success, error } = useNotification();
  const { hasPermission } = useAuth();

  const fetchBaseData = async () => {
    try {
      const [userResp, appList] = await Promise.all([
        userService.listUsers({ per_page: 100 }),
        applicationService.listApplications({ is_active: true }),
      ]);
      setUsers(userResp.users);
      setApps(appList);

      if (userResp.users.length > 0) {
        setSelectedUser(userResp.users[0].id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (userId: string) => {
    if (!userId) return;
    setAssignmentsLoading(true);
    try {
      const data = await assignmentService.getUserAssignments(userId);
      setUserAssignments(data);
    } catch (err: any) {
      error(err.message || 'Failed to load assignments');
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchAssignments(selectedUser);
    }
  }, [selectedUser]);

  const handleOpenAssign = () => {
    setCreateForm({
      user_id: selectedUser || users[0]?.id || '',
      application_id: apps[0]?.id || '',
      app_role: 'Project Lead',
      notes: '',
      expires_at: null,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditRole = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditAppRole(assignment.app_role || 'Member');
    setIsEditModalOpen(true);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    try {
      await assignmentService.updateAssignment(editingAssignment.id, {
        app_role: editAppRole,
      });
      success(`Updated role to "${editAppRole}" for ${editingAssignment.application_name}`);
      setIsEditModalOpen(false);
      fetchAssignments(selectedUser);
    } catch (err: any) {
      error(err.message || 'Failed to update application role');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignmentService.createAssignment(createForm);
      success('Application granted to employee');
      setIsModalOpen(false);
      fetchAssignments(createForm.user_id);
    } catch (err: any) {
      error(err.message || 'Failed to assign application');
    }
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!window.confirm(`Revoke access to ${assignment.application_name || 'this module'}?`)) return;
    try {
      await assignmentService.deleteAssignment(assignment.id);
      success('Access revoked');
      fetchAssignments(selectedUser);
    } catch (err: any) {
      error(err.message || 'Failed to delete assignment');
    }
  };

  const currentUserObj = users.find((u) => u.id === selectedUser);

  if (loading) return <LoadingSpinner message="Loading user access telemetry..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Assignments</h1>
          <p className="page-subtitle">
            Grant, supervise, and revoke employee entitlements to business modules
          </p>
        </div>
        {hasPermission('assignments.create') && (
          <button className="btn btn-primary" onClick={handleOpenAssign}>
            <Plus size={18} />
            <span>Assign Module</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* User Selection Sidebar */}
        <div className="table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Select Employee</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Choose an employee to view and manage assigned applications
            </p>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto', padding: 8 }}>
            {users.map((u) => {
              const isSelected = u.id === selectedUser;
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    border: isSelected ? '1px solid #c7d2fe' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isSelected ? 'var(--primary)' : '#e2e8f0',
                      color: isSelected ? 'white' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  >
                    {u.first_name[0]}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? '#3730a3' : 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {u.first_name} {u.last_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {u.department || 'General'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assigned Applications View */}
        <div className="table-card">
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Assigned Modules for {currentUserObj ? `${currentUserObj.first_name} ${currentUserObj.last_name}` : 'Employee'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {currentUserObj?.email}
              </span>
            </div>
            <span className="badge badge-primary">
              {userAssignments.length} Modules Assigned
            </span>
          </div>

          {assignmentsLoading ? (
            <LoadingSpinner message="Fetching user application assignments..." />
          ) : userAssignments.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
              <h4>No Business Applications Assigned</h4>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
                This employee has not been allocated access to any internal enterprise modules yet.
              </p>
              {hasPermission('assignments.create') && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={handleOpenAssign}
                >
                  Assign First Application
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application Module</th>
                    <th>Application Role</th>
                    <th>Status</th>
                    <th>Assigned Date</th>
                    <th>Expires</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userAssignments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Grid size={16} color="var(--primary)" />
                          <span>{a.application_name || 'Business Module'}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className={
                              a.app_role?.toLowerCase().includes('lead')
                                ? 'badge-role-lead'
                                : a.app_role?.toLowerCase().includes('staff') || a.app_role?.toLowerCase().includes('requester')
                                ? 'badge-role-staff'
                                : 'badge-role-admin'
                            }
                          >
                            <Shield size={11} />
                            <span>{a.app_role || 'Member'}</span>
                          </span>

                          {hasPermission('assignments.update') && (
                            <button
                              className="btn-icon"
                              title="Edit Application Role"
                              onClick={() => handleOpenEditRole(a)}
                              style={{ color: '#3F75A3', padding: '2px 4px' }}
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {a.status}
                        </span>
                      </td>

                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(a.assigned_at).toLocaleDateString()}
                      </td>

                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : 'Permanent'}
                      </td>

                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {a.notes || '—'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {hasPermission('assignments.delete') && (
                          <button
                            className="btn-icon"
                            title="Revoke access"
                            onClick={() => handleDeleteAssignment(a)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Application Module"
      >
        <form onSubmit={handleCreateAssignment}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Employee</label>
              <select
                className="form-control"
                value={createForm.user_id}
                onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Application Module</label>
              <select
                className="form-control"
                value={createForm.application_id}
                onChange={(e) => setCreateForm({ ...createForm, application_id: e.target.value })}
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} ({app.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Application-Specific Access Role</label>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Select or customize the specific role this employee will hold within this application:
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {['Project Lead', 'Manager / Approver', 'Requester / Staff', 'Administrator', 'Member'].map((rolePreset) => (
                  <button
                    key={rolePreset}
                    type="button"
                    className={`btn btn-sm ${createForm.app_role === rolePreset ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                    onClick={() => setCreateForm({ ...createForm, app_role: rolePreset })}
                  >
                    {rolePreset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Project Lead, Requester / Staff, Reviewer..."
                value={createForm.app_role || ''}
                onChange={(e) => setCreateForm({ ...createForm, app_role: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes / Purpose</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Business rationale or department requirement..."
                value={createForm.notes || ''}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Grant Module Access
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Change Role: ${editingAssignment?.application_name || 'Application'}`}
      >
        <form onSubmit={handleUpdateRole}>
          <div className="modal-body">
            <div style={{ marginBottom: 14, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Updating application role for <strong>{currentUserObj?.first_name} {currentUserObj?.last_name}</strong> in module <strong>{editingAssignment?.application_name}</strong>.
            </div>

            <div className="form-group">
              <label className="form-label">Select Predefined Role</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['Project Lead', 'Manager / Approver', 'Requester / Staff', 'Administrator', 'Member', 'Auditor / Read-Only'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn btn-sm ${editAppRole === preset ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                    onClick={() => setEditAppRole(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Application Role Title</label>
              <input
                type="text"
                className="form-control"
                value={editAppRole}
                onChange={(e) => setEditAppRole(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Application Role
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
