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

const ADMIN_EMAIL = 'admin@nexgencare.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_USER: User = {
  id: 'admin-1',
  email: ADMIN_EMAIL,
  name: 'Zihan',
  role: 'ADMIN',
};

function generateToken(): string {
  const payload = btoa(JSON.stringify({ 
    userId: ADMIN_USER.id, 
    email: ADMIN_USER.email, 
    role: ADMIN_USER.role, 
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 
  }));
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  return `${header}.${payload}.`;
}

function parseToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

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

      // Try API first
      try {
        const data = await api.getMe();
        setState({ user: data.user, isLoading: false, isInitialized: true });
      } catch {
        // Fallback to local token
        const payload = parseToken(token);
        if (payload?.email === ADMIN_EMAIL) {
          setState({ user: ADMIN_USER, isLoading: false, isInitialized: true });
        } else {
          localStorage.removeItem('token');
          setState({ user: null, isLoading: false, isInitialized: true });
        }
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    // Try real API
    try {
      const data = await api.login(email, password);
      localStorage.setItem('token', data.token);
      setState({ user: data.user, isLoading: false, isInitialized: true });
    } catch {
      // Local fallback
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        localStorage.setItem('token', generateToken());
        setState({ user: ADMIN_USER, isLoading: false, isInitialized: true });
      } else {
        throw new Error('Invalid credentials');
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({ user: null, isLoading: false, isInitialized: true });
    window.location.href = '/';
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