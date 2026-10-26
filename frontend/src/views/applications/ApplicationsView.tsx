import React, { useEffect, useState } from 'react';
import { applicationService } from '@/services/applicationService';
import { Application, ApplicationCreatePayload } from '@/types';
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
} from 'lucide-react';

export const ApplicationsView: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  const [formData, setFormData] = useState<ApplicationCreatePayload>({
    name: '',
    slug: '',
    description: '',
    category: 'Core',
    color: '#6366F1',
    url: '',
    is_core: false,
    requires_license: false,
    max_users: null,
  });

  const { user, hasPermission } = useAuth();
  const { success, error } = useNotification();
  const isEmployeeOnly = !user?.is_superadmin && !hasPermission('employees.read');

  const fetchApps = async () => {
    try {
      const data = isEmployeeOnly
        ? await applicationService.getMyApplications()
        : await applicationService.listApplications();
      setApps(data);
    } catch (err: any) {
      error(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [isEmployeeOnly]);

  const handleOpenCreate = () => {
    setEditingApp(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      category: 'Core',
      color: '#6366F1',
      url: '',
      is_core: false,
      requires_license: false,
      max_users: null,
    });
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
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingApp) {
        await applicationService.updateApplication(editingApp.id, formData);
        success('Application module updated successfully');
      } else {
        await applicationService.createApplication(formData);
        success('Application module created successfully');
      }
      setIsModalOpen(false);
      fetchApps();
    } catch (err: any) {
      error(err.message || 'Failed to save application');
    }
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`Are you sure you want to delete "${app.name}"?`)) return;
    try {
      await applicationService.deleteApplication(app.id);
      success('Application deleted');
      fetchApps();
    } catch (err: any) {
      error(err.message || 'Failed to delete application');
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.slug.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || app.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(apps.map((a) => a.category).filter((c): c is string => Boolean(c))))];

  if (loading) return <LoadingSpinner message="Loading application catalog..." />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEmployeeOnly ? 'My Assigned Applications' : 'Business Applications & Modules'}
          </h1>
          <p className="page-subtitle">
            {isEmployeeOnly
              ? 'Only the applications and workspaces assigned to your employee account'
              : 'Manage enterprise services, portal apps, and module configurations'}
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
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Category:
            </span>
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
                <div
                  className="app-card-icon"
                  style={{ background: app.color || 'var(--primary)' }}
                >
                  <Grid size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 className="app-card-title">{app.name}</h4>
                    {app.user_app_role ? (
                      <span
                        className={
                          app.user_app_role.toLowerCase().includes('lead')
                            ? 'badge-role-lead'
                            : app.user_app_role.toLowerCase().includes('staff') || app.user_app_role.toLowerCase().includes('requester')
                            ? 'badge-role-staff'
                            : 'badge-role-admin'
                        }
                      >
                        Role: {app.user_app_role}
                      </span>
                    ) : app.is_core ? (
                      <span className="badge badge-primary">Core</span>
                    ) : null}
                  </div>
                  <span className="badge badge-neutral" style={{ marginTop: 4 }}>
                    {app.category || 'Module'}
                  </span>
                </div>
              </div>
              <p className="app-card-desc">{app.description || 'No description provided.'}</p>
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
                  <span>{app.assigned_users || 0} active users</span>
                </span>
                <span className={`badge ${app.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {app.is_active ? 'Active' : 'Disabled'}
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
                  onClick={() => window.alert(`Navigating to ${app.name} (${app.slug})`)}
                >
                  <span>Launch App</span>
                  <ExternalLink size={13} />
                </button>
                {hasPermission('applications.update') && (
                  <button
                    className="btn-icon"
                    title="Edit module"
                    onClick={() => handleOpenEdit(app)}
                  >
                    <Edit2 size={15} />
                  </button>
                )}
                {hasPermission('applications.delete') && !app.is_core && (
                  <button
                    className="btn-icon"
                    title="Delete module"
                    onClick={() => handleDelete(app)}
                    style={{ color: 'var(--danger)' }}
                  >
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
        title={editingApp ? 'Edit Application Module' : 'Register New Application'}
      >
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Module Name</label>
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

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Business purpose and workflow synopsis..."
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    style={{ width: 42, height: 42, border: 'none', cursor: 'pointer', borderRadius: 8 }}
                    value={formData.color || '#6366F1'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={formData.color || ''}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Internal Route / Launch URL</label>
              <input
                type="text"
                className="form-control"
                value={formData.url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="/apps/supply-chain"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingApp ? 'Save Changes' : 'Create Module'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
