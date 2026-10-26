import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import { useNotification } from '@/stores/NotificationContext';
import { Mail, Lock, User, Briefcase, Building, Loader2, ArrowRight } from 'lucide-react';

export const RegisterView: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    department: 'Engineering',
    designation: 'Staff Associate',
  });
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { error, success } = useNotification();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData);
      success('Account created successfully!', 'Registration Complete');
      navigate('/');
    } catch (err: any) {
      error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">First Name</label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              name="first_name"
              className="form-control"
              style={{ paddingLeft: 38 }}
              required
              value={formData.first_name}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Last Name</label>
          <input
            type="text"
            name="last_name"
            className="form-control"
            required
            value={formData.last_name}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Corporate Email</label>
        <div style={{ position: 'relative' }}>
          <Mail size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="email"
            name="email"
            className="form-control"
            style={{ paddingLeft: 38 }}
            required
            value={formData.email}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Password</label>
        <div style={{ position: 'relative' }}>
          <Lock size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="password"
            name="password"
            className="form-control"
            style={{ paddingLeft: 38 }}
            required
            value={formData.password}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Department</label>
          <div style={{ position: 'relative' }}>
            <Building size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              name="department"
              className="form-control"
              style={{ paddingLeft: 38 }}
              value={formData.department}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Designation</label>
          <div style={{ position: 'relative' }}>
            <Briefcase size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              name="designation"
              className="form-control"
              style={{ paddingLeft: 38 }}
              value={formData.designation}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', padding: '12px', marginTop: 12 }}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Registering Account...</span>
          </>
        ) : (
          <>
            <span>Create Employee Account</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: '#64748b' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Sign In
        </Link>
      </div>
    </form>
  );
};
