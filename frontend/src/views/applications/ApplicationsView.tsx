import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationService } from '@/services/applicationService';
import { errorMessage } from '@/services/apiClient';
import {
  Application,
  ApplicationCreatePayload,
  AuthMethod,
  INTEGRATION_LABELS,
  IntegrationType,
  MyApplication,
} from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';
import { useNotification } from '@/stores/NotificationContext';
import { useAuth } from '@/stores/AuthContext';
import {
  Grid,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Layers,
  Users,
  RefreshCw,
  PlugZap,
} from 'lucide-react';

type FormState = ApplicationCreatePayload & { is_active?: boolean };

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  description: '',
  category: 'Core',
  color: '#6366F1',
  url: '',
  is_core: false,
  requires_license: false,
  max_users: null,
  auth_method: 'entra_sso',
  integration_type: 'manual',
  connector_config: {},
  connector_secret_ref: '',
};

const STATUS_BADGE: Record<string, string> = {
  manual: 'badge-neutral',
  unconfigured: 'badge-warning',
  configured: 'badge-primary',
  healthy: 'badge-success',
  error: 'badge-danger',
};

const openApp = (url: string, navigate: (to: string) => void) => {
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
  else if (/^\/(?![/\\])/.test(url) && !url.includes('\\')) navigate(url); // internal routes only
};

/** Employees: their own applications and access state. */
const MyApplicationsGrid: React.FC = () => {
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const { error } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    applicationService
      .getMyApplications()
      .then(setApps)
      .catch((err) => error(errorMessage(err, 'Failed to load your applications')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your applications..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-subtitle">Applications you have been granted access to</p>
        </div>
      </div>
      {apps.length === 0 ? (
        <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No applications have been assigned to you yet.
        </div>
      ) : (
        <div className="apps-grid">
          {apps.map((app) => (
            <div key={app.id} className="app-card">
              <div>
                <div className="app-card-header">
                  <div className="app-card-icon" style={{ background: app.color || 'var(--primary)' }}>
                    <Grid size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 className="app-card-title">{app.name}</h4>
                    <span className="badge badge-neutral" style={{ marginTop: 4 }}>
                      {app.roles.join(', ')}
                    </span>
                  </div>
                </div>
                <p className="app-card-desc">
                  {app.access_state === 'ready' ? app.description || '' : app.status_message}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={app.access_state !== 'ready' || !app.url}
                title={app.access_state !== 'ready' ? 'Available once your access is verified' : undefined}
                onClick={() => app.url && openApp(app.url, navigate)}
              >
                <span>{app.access_state === 'ready' ? 'Open' : app.access_state === 'failed' ? 'Access failed' : 'Access pending'}</span>
                <ExternalLink size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Administrators: the application registry and connector configuration. */
const ApplicationRegistry: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const { hasPermission } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();

  const fetchApps = async () => {
    try {
      setApps(await applicationService.listApplications());
    } catch (err) {
      error(errorMessage(err, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleOpenCreate = () => {
    setEditingApp(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (app: Application) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      slug: app.slug,
      description: app.description || '',
      category: app.category || 'Core',
      color: app.color || '#6366F1',
      url: app.url || '',
      is_core: app.is_core,
      requires_license: app.requires_license,
      max_users: app.max_users || null,
      auth_method: app.auth_method,
      integration_type: app.integration_type,
      connector_config: app.connector_config || {},
      connector_secret_ref: app.connector_secret_ref || '',
      is_active: app.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { is_active, ...fields } = formData;
    const payload = {
      ...fields,
      url: formData.url || null,
      connector_secret_ref: formData.connector_secret_ref || null,
      connector_config: formData.integration_type === 'manual' ? null : formData.connector_config,
    };
    try {
      if (editingApp) {
        const { slug: _slug, is_core: _core, roles: _roles, ...update } = payload;
        await applicationService.updateApplication(editingApp.id, { ...update, is_active });
        success('Application updated');
      } else {
        await applicationService.createApplication(payload);
        success('Application registered');
      }
      setIsModalOpen(false);
      fetchApps();
    } catch (err) {
      error(errorMessage(err, 'Failed to save application'));
    }
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`Delete "${app.name}"? Its access history is deleted too. Deactivating keeps history.`)) return;
    try {
      await applicationService.deleteApplication(app.id);
      success('Application deleted');
      fetchApps();
    } catch (err) {
      error(errorMessage(err, 'Failed to delete application'));
    }
  };

  const handleTest = async (app: Application) => {
    setBusyId(app.id);
    try {
      const result = await applicationService.testConnection(app.id);
      (result.ok ? success : error)(result.message, `${app.name}: connection test`);
      fetchApps();
    } catch (err) {
      error(errorMessage(err, 'Connection test failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncRoles = async (app: Application) => {
    setBusyId(app.id);
    try {
      const result = await applicationService.syncRoles(app.id);
      success(
        `${result.added.length} added, ${result.updated.length} matched, ${result.missing.length} no longer in the app`,
        `${app.name}: roles synchronised`,
      );
      fetchApps();
    } catch (err) {
      error(errorMessage(err, 'Role sync failed'));
    } finally {
      setBusyId(null);
    }
  };

  const setConfig = (key: string, value: string) =>
    setFormData({ ...formData, connector_config: { ...(formData.connector_config || {}), [key]: value } });

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.slug.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (categoryFilter === 'all' || app.category === categoryFilter);
  });

  const categories = ['all', ...Array.from(new Set(apps.map((a) => a.category).filter((c): c is string => Boolean(c))))];

  if (loading) return <LoadingSpinner message="Loading application catalog..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Applications & Modules</h1>
          <p className="page-subtitle">
            Registered applications, their role catalogues and how access changes reach them
          </p>
        </div>
        {hasPermission('applications.create') && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Register Application</span>
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
              placeholder="Search by module name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Layers size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Apps Grid */}
      <div className="apps-grid">
        {filteredApps.map((app) => (
          <div key={app.id} className="app-card">
            <div>
              <div className="app-card-header">
                <div className="app-card-icon" style={{ background: app.color || 'var(--primary)' }}>
                  <Grid size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 className="app-card-title">{app.name}</h4>
                    {app.is_core && <span className="badge badge-primary">Core</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="badge badge-neutral">{app.category || 'Module'}</span>
                    <span className={`badge ${STATUS_BADGE[app.integration_status] || 'badge-neutral'}`}>
                      {INTEGRATION_LABELS[app.integration_type]} · {app.integration_status}
                    </span>
                  </div>
                </div>
              </div>
              <p className="app-card-desc">{app.description || 'No description provided.'}</p>
              {app.last_connection_error && (
                <p style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 4 }}>{app.last_connection_error}</p>
              )}
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={14} />
                  <span>
                    {app.assigned_users || 0} users · {app.roles.length} roles
                  </span>
                </span>
                <span className={`badge ${app.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {app.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  disabled={!app.url}
                  title={app.url ? app.url : 'No launch URL registered'}
                  onClick={() => app.url && openApp(app.url, navigate)}
                >
                  <span>Open</span>
                  <ExternalLink size={13} />
                </button>
                {hasPermission('applications.update') && app.integration_type !== 'manual' && (
                  <>
                    <button className="btn-icon" title="Test connection" disabled={busyId === app.id} onClick={() => handleTest(app)}>
                      <PlugZap size={15} />
                    </button>
                    <button className="btn-icon" title="Sync roles from the application" disabled={busyId === app.id} onClick={() => handleSyncRoles(app)}>
                      <RefreshCw size={15} />
                    </button>
                  </>
                )}
                {hasPermission('applications.update') && (
                  <button className="btn-icon" title="Edit application" onClick={() => handleOpenEdit(app)}>
                    <Edit2 size={15} />
                  </button>
                )}
                {hasPermission('applications.delete') && !app.is_core && (
                  <button className="btn-icon" title="Delete application" onClick={() => handleDelete(app)} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingApp ? 'Edit Application' : 'Register New Application'}
      >
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Application Name</label>
              <input
                type="text"
                className="form-control"
                required
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  setFormData({ ...formData, name, slug: editingApp ? formData.slug : slug });
                }}
                placeholder="e.g. Supply Chain Analytics"
              />
            </div>

            {!editingApp && (
              <div className="form-group">
                <label className="form-label">Identifier Slug</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="supply-chain-analytics"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={2}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="HR, Finance, Operations"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Theme Color</label>
                <input
                  type="color"
                  style={{ width: 42, height: 42, border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  value={formData.color || '#6366F1'}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Launch URL</label>
              <input
                type="text"
                className="form-control"
                value={formData.url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://crm.in2itebs.com"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Employee sign-in</label>
                <select
                  className="form-control"
                  value={formData.auth_method}
                  onChange={(e) => setFormData({ ...formData, auth_method: e.target.value as AuthMethod })}
                >
                  <option value="entra_sso">Microsoft Entra SSO</option>
                  <option value="oidc">Other OIDC</option>
                  <option value="saml">SAML</option>
                  <option value="local">App's own login</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Max users</label>
                <input
                  type="number"
                  min={1}
                  className="form-control"
                  value={formData.max_users ?? ''}
                  onChange={(e) => setFormData({ ...formData, max_users: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">How access changes reach the application</label>
              <select
                className="form-control"
                value={formData.integration_type}
                onChange={(e) => setFormData({ ...formData, integration_type: e.target.value as IntegrationType })}
              >
                {(Object.keys(INTEGRATION_LABELS) as IntegrationType[]).map((t) => (
                  <option key={t} value={t}>
                    {INTEGRATION_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {formData.integration_type === 'entra_app_roles' && (
              <div className="form-group">
                <label className="form-label">Enterprise application (service principal) object ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.connector_config?.service_principal_id || ''}
                  onChange={(e) => setConfig('service_principal_id', e.target.value)}
                />
              </div>
            )}

            {(formData.integration_type === 'scim' || formData.integration_type === 'custom_api') && (
              <div className="form-group">
                <label className="form-label">
                  {formData.integration_type === 'scim' ? 'SCIM base URL' : 'Provisioning API base URL'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.connector_config?.base_url || ''}
                  onChange={(e) => setConfig('base_url', e.target.value)}
                  placeholder="https://app.example.com/scim/v2"
                />
              </div>
            )}

            {formData.integration_type !== 'manual' && (
              <div className="form-group">
                <label className="form-label">Credential secret name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.connector_secret_ref || ''}
                  onChange={(e) => setFormData({ ...formData, connector_secret_ref: e.target.value.toUpperCase() })}
                  placeholder={formData.integration_type === 'entra_app_roles' ? 'GRAPH_CLIENT_SECRET' : 'CRM_PROVISIONING_TOKEN'}
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  The name of a server environment variable or Key Vault reference. Never paste the secret itself.
                </small>
              </div>
            )}

            {editingApp && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active ?? editingApp.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Active (inactive applications cannot be granted)
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingApp ? 'Save Changes' : 'Register Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ApplicationsView: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isEmployeeOnly = !user?.is_superadmin && !hasPermission('employees.read');
  return isEmployeeOnly ? <MyApplicationsGrid /> : <ApplicationRegistry />;
};
