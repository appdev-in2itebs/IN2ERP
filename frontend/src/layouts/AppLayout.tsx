import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { ToastContainer } from '@/components/ToastContainer';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isFullscreen =
    location.pathname === '/' ||
    location.pathname === '/settings' ||
    location.pathname === '/employees';

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Overview & Analytics';
      case '/applications':
        return 'Business Applications';
      case '/employees':
        return 'Employee Directory';
      case '/settings':
        return 'Master Data & Settings';
      case '/roles':
        return 'Roles & Access Control (RBAC)';
      case '/assignments':
        return 'Application Assignments';
      case '/audit':
        return 'Audit Logs & Security Trail';
      default:
        return 'Management Portal';
    }
  };

  if (isFullscreen) {
    return (
      <div className="launchpad-fullscreen-shell">
        <Outlet />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar title={getPageTitle(location.pathname)} />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
