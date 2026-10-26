import React, { useEffect, useState } from 'react';
import { auditService } from '@/services/auditService';
import { AuditLog } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNotification } from '@/stores/NotificationContext';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
} from 'lucide-react';

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { error } = useNotification();

  const fetchLogs = async () => {
    try {
      const data = await auditService.listLogs({
        page,
        per_page: 25,
        action: actionFilter || undefined,
        resource_type: resourceFilter || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      error(err.message || 'Failed to retrieve audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter]);

  if (loading) return <LoadingSpinner message="Auditing compliance trail..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs & Security Trail</h1>
          <p className="page-subtitle">
            Immutable, compliance-ready event logs of enterprise actions and access changes
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="table-card" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Action:
            </span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actions</option>
              <option value="login">User Login</option>
              <option value="login_failed">Failed Login</option>
              <option value="register">Registration</option>
              <option value="assign_app">App Assignment</option>
              <option value="delete_assignment">Assignment Revocation</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Shield size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Resource:
            </span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Resources</option>
              <option value="auth">Authentication</option>
              <option value="assignment">Assignments</option>
              <option value="user">Users</option>
              <option value="role">Roles</option>
              <option value="application">Applications</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor / User</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Status</th>
                <th>Details / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600 }}>{log.user_email || 'System'}</div>
                    {log.ip_address && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        IP: {log.ip_address}
                      </div>
                    )}
                  </td>

                  <td>
                    <span className="badge badge-primary">{log.action}</span>
                  </td>

                  <td>
                    <span className="badge badge-neutral">{log.resource_type}</span>
                  </td>

                  <td>
                    <span
                      className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {log.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{log.status}</span>
                    </span>
                  </td>

                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No audit records logged yet.
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
          <span>Showing {logs.length} of {total} event records</span>
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
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
