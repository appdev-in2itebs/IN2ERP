export * from './user';
export * from './auth';
export * from './role';
export * from './application';
export * from './assignment';
export * from './audit';

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  total_applications: number;
  active_applications: number;
  total_assignments: number;
  recent_activity_count: number;
  departments: string[];
}
