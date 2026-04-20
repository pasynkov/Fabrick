import { createContext, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AuthUser { id: string; email: string }

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem('token');
  const storedUser = sessionStorage.getItem('user');
  const [token, setToken] = useState<string | null>(stored);
  const [user, setUser] = useState<AuthUser | null>(storedUser ? JSON.parse(storedUser) : null);

  function setAuth(t: string, u: AuthUser) {
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, token, setAuth, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
