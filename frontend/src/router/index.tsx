import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Views
import { LoginView } from '@/views/auth/LoginView';
import { RegisterView } from '@/views/auth/RegisterView';
import { DashboardView } from '@/views/dashboard/DashboardView';
import { ApplicationsView } from '@/views/applications/ApplicationsView';
import { EmployeesView } from '@/views/employees/EmployeesView';
import { RolesView } from '@/views/roles/RolesView';
import { AssignmentsView } from '@/views/assignments/AssignmentsView';
import { AuditView } from '@/views/audit/AuditView';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />
      </Route>

      {/* Protected ERP Console Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardView />} />
        <Route
          path="/applications"
          element={
            <ProtectedRoute permission="applications.read">
              <ApplicationsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute permission="employees.read">
              <EmployeesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute permission="roles.read">
              <RolesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute permission="assignments.read">
              <AssignmentsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute permission="audit.read">
              <AuditView />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
