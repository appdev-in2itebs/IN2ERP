import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthConfig, User } from '@/types';
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { entraAuth } from '@/services/entraAuth';

interface AuthContextType {
  user: User | null;
  config: AuthConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      setUser(await authService.getCurrentUser());
    } catch {
      setUser(null);
      apiClient.clear();
    }
  };

  // Restore a session: Microsoft (MSAL redirect/cache) first, then the password refresh cookie.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cfg = await authService.getConfig();
        setConfig(cfg);
        if (cfg.entra_enabled && cfg.entra) {
          const account = await entraAuth.init(cfg.entra);
          if (account) {
            apiClient.setTokenProvider(entraAuth.getAccessToken);
            await fetchProfile();
            return;
          }
        }
        if (cfg.local_login_enabled && (await authService.restoreLocalSession())) {
          await fetchProfile();
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();

    const handleAuthExpired = () => {
      setUser(null);
      apiClient.clear();
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    await authService.login(email, pass);
    await fetchProfile();
  };

  const loginWithMicrosoft = async () => {
    await entraAuth.signIn(); // redirects; the session is picked up on return
  };

  const changePassword = async (current: string, next: string) => {
    await authService.changePassword(current, next);
    await fetchProfile();
  };

  const logout = async () => {
    const wasEntra = user?.auth_method === 'entra';
    setUser(null);
    if (wasEntra) {
      apiClient.clear();
      await entraAuth.signOut();
    } else {
      await authService.logout().catch(() => apiClient.clear());
    }
  };

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.is_superadmin) return true;
    return user.permissions?.includes(code) ?? false;
  };

  const hasAnyPermission = (codes: string[]): boolean => codes.some(hasPermission);

  return (
    <AuthContext.Provider
      value={{
        user,
        config,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithMicrosoft,
        changePassword,
        logout,
        refreshProfile: fetchProfile,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
