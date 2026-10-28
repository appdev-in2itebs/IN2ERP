import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

/**
 * Hides screens the user cannot use. This is navigation only: every API endpoint
 * enforces the same permissions on the server.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner message="Verifying session credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
          Access Restricted
        </h2>
        <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
          You do not have the required permission (<code>{permission}</code>) to access this enterprise module.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
