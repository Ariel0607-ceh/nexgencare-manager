import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: User | null;
    isLoading: boolean;
    isInitialized: boolean;
  }>({
    user: null,
    isLoading: true,
    isInitialized: false,
  });

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setState({ user: null, isLoading: false, isInitialized: true });
        return;
      }

      try {
        const data = await api.getMe();
        setState({ user: data.user, isLoading: false, isInitialized: true });
      } catch {
        localStorage.removeItem('token');
        setState({ user: null, isLoading: false, isInitialized: true });
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.token);
    setState({ user: data.user, isLoading: false, isInitialized: true });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({ user: null, isLoading: false, isInitialized: true });
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        isLoading: state.isLoading,
        isAuthenticated: !!state.user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}