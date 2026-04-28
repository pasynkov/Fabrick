import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { doRefresh, isTokenExpiringSoon } from './tokenRefresh';

interface AuthUser { id: string; email: string }

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  refreshing: boolean;
  setAuth: (token: string, user: AuthUser, refreshToken: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem('token');
  const storedUser = sessionStorage.getItem('user');
  const storedRefresh = sessionStorage.getItem('refresh_token');
  const [token, setToken] = useState<string | null>(stored);
  const [user, setUser] = useState<AuthUser | null>(storedUser ? JSON.parse(storedUser) : null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setAuth(t: string, u: AuthUser, refreshToken: string) {
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    sessionStorage.setItem('refresh_token', refreshToken);
    setToken(t);
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  async function tryProactiveRefresh() {
    const currentToken = sessionStorage.getItem('token');
    const currentRefresh = sessionStorage.getItem('refresh_token');
    if (!currentToken || !currentRefresh) return;
    if (!isTokenExpiringSoon(currentToken)) return;

    setRefreshing(true);
    try {
      const result = await doRefresh(currentRefresh);
      const currentUser = sessionStorage.getItem('user');
      const u: AuthUser = currentUser ? JSON.parse(currentUser) : user;
      setAuth(result.access_token, u!, result.refresh_token);
    } catch {
      logout();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    intervalRef.current = setInterval(tryProactiveRefresh, 60 * 1000);
    tryProactiveRefresh();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [!!token]);

  return (
    <Ctx.Provider value={{ user, token, refreshing, setAuth, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, refreshing } = useAuth();
  const location = useLocation();
  if (refreshing) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!token) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
