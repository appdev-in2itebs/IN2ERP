import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/stores/AuthContext';
import { NotificationProvider } from '@/stores/NotificationContext';
import { AppRouter } from '@/router';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
