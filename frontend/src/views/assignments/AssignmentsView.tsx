import React, { useEffect, useState } from 'react';
import { assignmentService } from '@/services/assignmentService';
import { userService } from '@/services/userService';
import { applicationService } from '@/services/applicationService';
import { errorMessage } from '@/services/apiClient';
import { Application, Assignment, PlannedChange, PROVISIONING_LABELS, User } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useNotification } from '@/stores/NotificationContext';
import { useAuth } from '@/stores/AuthContext';
import { Plus, Grid, Trash2, AlertCircle, Shield, RotateCcw, CheckCircle2, PlayCircle } from 'lucide-react';

const TONE_BADGE = { ok: 'badge-success', wait: 'badge-primary', warn: 'badge-warning', bad: 'badge-danger', muted: 'badge-neutral' };

interface GrantForm {
  application_id: string;
  app_role_id: string;
  expires_at: string;
  notes: string;
}

export const ProvisioningBadge: React.FC<{ assignment: Assignment }> = ({ assignment }) => {
  const meta = PROVISIONING_LABELS[assignment.provisioning_status] ?? { label: assignment.provisioning_status, tone: 'muted' };
  return (
    <span className={`badge ${TONE_BADGE[meta.tone]}`} title={assignment.last_error || undefined}>
      {meta.label}
    </span>
  );
};

export const AssignmentsView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userAssignments, setUserAssignments] = useState<Assignment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [grantForm, setGrantForm] = useState<GrantForm>({ application_id: '', app_role_id: '', expires_at: '', notes: '' });
  const [review, setReview] = useState<PlannedChange[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      if (userResp.users.length > 0) setSelectedUser(userResp.users[0].id);
    } catch (err) {
      error(errorMessage(err, 'Failed to load employees and applications'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (userId: string, history = showHistory) => {
    if (!userId) return;
    setAssignmentsLoading(true);
    try {
      setUserAssignments(await assignmentService.getUserAssignments(userId, history));
    } catch (err) {
      error(errorMessage(err, 'Failed to load assignments'));
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (selectedUser) fetchAssignments(selectedUser);
  }, [selectedUser, showHistory]);

  const selectedApp = apps.find((a) => a.id === grantForm.application_id);

  const handleOpenAssign = () => {
    const app = apps[0];
    setGrantForm({
      application_id: app?.id || '',
      app_role_id: app?.roles.find((r) => r.is_default)?.id || app?.roles[0]?.id || '',
      expires_at: '',
      notes: '',
    });
    setReview(null);
    setIsModalOpen(true);
  };

  const grantRequest = (dryRun: boolean) =>
    assignmentService.changeAccess(selectedUser, {
      grants: [
        {
          application_id: grantForm.application_id,
          app_role_id: grantForm.app_role_id,
          expires_at: grantForm.expires_at ? new Date(`${grantForm.expires_at}T23:59:59`).toISOString() : null,
          notes: grantForm.notes || null,
        },
      ],
      revokes: [],
      dry_run: dryRun,
    });

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      setReview((await grantRequest(true)).changes);
    } catch (err) {
      error(errorMessage(err, 'The change was rejected'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await grantRequest(false);
      const status = result.assignments[0] ? PROVISIONING_LABELS[result.assignments[0].provisioning_status].label : '';
      success(`Grant recorded. Provisioning status: ${status}`);
      setIsModalOpen(false);
      fetchAssignments(selectedUser);
    } catch (err) {
      error(errorMessage(err, 'Failed to grant access'));
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (label: string, action: () => Promise<Assignment>) => {
    try {
      const updated = await action();
      success(`${label}: ${PROVISIONING_LABELS[updated.provisioning_status].label}`);
      fetchAssignments(selectedUser);
    } catch (err) {
      error(errorMessage(err, `${label} failed`));
    }
  };

  const handleRevoke = (a: Assignment) => {
    if (!window.confirm(`Revoke ${a.app_role} in ${a.application_name}? Access is removed in the ERP now; the application confirms the removal separately.`)) return;
    runAction('Revocation started', () => assignmentService.revokeAssignment(a.id));
  };

  const handleConfirmManual = (a: Assignment) => {
    const note = window.prompt(
      `Confirm that ${a.status === 'active' ? 'this role was granted' : 'this role was removed'} in ${a.application_name}. Optional note:`,
      '',
    );
    if (note === null) return;
    runAction('Confirmed', () => assignmentService.confirmManual(a.id, note || undefined));
  };

  const handleRunQueue = async () => {
    try {
      const result = await assignmentService.runProvisioning();
      const summary = Object.entries(result.jobs).map(([k, v]) => `${v} ${k}`).join(', ') || 'no jobs due';
      success(`${summary}; ${result.expired} expired`, 'Provisioning queue processed');
      fetchAssignments(selectedUser);
    } catch (err) {
      error(errorMessage(err, 'Could not process the queue'));
    }
  };

  const currentUserObj = users.find((u) => u.id === selectedUser);
  const activeCount = userAssignments.filter((a) => a.status === 'active').length;

  if (loading) return <LoadingSpinner message="Loading user access..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Access</h1>
          <p className="page-subtitle">
            Grant and revoke employees' application roles and follow their confirmation in each application
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPermission('assignments.update') && (
            <button className="btn btn-secondary" onClick={handleRunQueue} title="Deliver queued changes to connected applications now">
              <PlayCircle size={18} />
              <span>Process queue now</span>
            </button>
          )}
          {hasPermission('assignments.create') && (
            <button className="btn btn-primary" onClick={handleOpenAssign} disabled={!selectedUser}>
              <Plus size={18} />
              <span>Grant Role</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* User Selection Sidebar */}
        <div className="table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Select Employee</h3>
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
                    opacity: u.is_active ? 1 : 0.55,
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
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {u.first_name} {u.last_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {u.is_active ? u.department || 'General' : 'Deactivated'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignments */}
        <div className="table-card">
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {currentUserObj ? `${currentUserObj.first_name} ${currentUserObj.last_name}` : 'Employee'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{currentUserObj?.email}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
                Show revoked & expired
              </label>
              <span className="badge badge-primary">{activeCount} active roles</span>
            </div>
          </div>

          {assignmentsLoading ? (
            <LoadingSpinner message="Fetching application roles..." />
          ) : userAssignments.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
              <h4>No application roles</h4>
              <p style={{ fontSize: '0.85rem', marginTop: 4 }}>This employee holds no application roles.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Role</th>
                    <th>Access</th>
                    <th>In application</th>
                    <th>Expires</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userAssignments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Grid size={16} color="var(--primary)" />
                          <span>{a.application_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge-role-admin">
                          <Shield size={11} />
                          <span>{a.app_role}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{a.status}</span>
                      </td>
                      <td>
                        <ProvisioningBadge assignment={a} />
                        {a.last_error && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 4, maxWidth: 260 }}>{a.last_error}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {hasPermission('assignments.update') && a.provisioning_status === 'manual_action_required' && (
                          <button className="btn-icon" title="Confirm the app owner applied this change" onClick={() => handleConfirmManual(a)}>
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {hasPermission('assignments.update') &&
                          (a.provisioning_status === 'failed' || a.provisioning_status === 'reconciliation_required') && (
                            <button className="btn-icon" title="Retry provisioning" onClick={() => runAction('Retry queued', () => assignmentService.retry(a.id))}>
                              <RotateCcw size={15} />
                            </button>
                          )}
                        {hasPermission('assignments.delete') && a.status === 'active' && (
                          <button className="btn-icon" title="Revoke role" onClick={() => handleRevoke(a)} style={{ color: 'var(--danger)' }}>
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

      {/* Grant Modal: choose → review (server dry run) → confirm */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={review ? 'Review change' : 'Grant Application Role'}>
        {review ? (
          <div>
            <div className="modal-body">
              <p style={{ fontSize: '0.86rem', marginBottom: 12 }}>
                For <strong>{currentUserObj?.first_name} {currentUserObj?.last_name}</strong>:
              </p>
              {review.map((c) => (
                <div key={`${c.application_id}-${c.app_role_id}`} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.action === 'grant' ? 'Grant' : 'Revoke'} {c.app_role} in {c.application_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{c.outcome}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReview(null)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting}>
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReview}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Application</label>
                <select
                  className="form-control"
                  value={grantForm.application_id}
                  onChange={(e) => {
                    const app = apps.find((a) => a.id === e.target.value);
                    setGrantForm({
                      ...grantForm,
                      application_id: e.target.value,
                      app_role_id: app?.roles.find((r) => r.is_default)?.id || app?.roles[0]?.id || '',
                    });
                  }}
                >
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Role in {selectedApp?.name || 'application'}</label>
                {selectedApp && selectedApp.roles.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>
                    This application has no roles in its catalogue yet. Add or sync its roles first.
                  </p>
                ) : (
                  <select
                    className="form-control"
                    required
                    value={grantForm.app_role_id}
                    onChange={(e) => setGrantForm({ ...grantForm, app_role_id: e.target.value })}
                  >
                    {selectedApp?.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.sync_status === 'missing' ? ' (no longer in app)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Expires (optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={grantForm.expires_at}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setGrantForm({ ...grantForm, expires_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Purpose</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={grantForm.notes}
                  onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !grantForm.app_role_id}>
                Review change
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
