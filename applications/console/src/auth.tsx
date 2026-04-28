import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearRefreshCookie, doRefresh, getRefreshCookie, isTokenExpired, isTokenExpiringSoon, setRefreshCookie } from './tokenRefresh';

interface AuthUser { id: string; email: string }

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  refreshing: boolean;
  setAuth: (token: string, user: AuthUser, refreshToken?: string, persistent?: boolean) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setAuth(t: string, u: AuthUser, refreshToken?: string, persistent?: boolean) {
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    if (persistent && refreshToken) {
      setRefreshCookie(refreshToken);
      sessionStorage.removeItem('refresh_token');
    } else if (!persistent && refreshToken) {
      sessionStorage.setItem('refresh_token', refreshToken);
    }
    setToken(t);
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('refresh_token');
    clearRefreshCookie();
    setToken(null);
    setUser(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  async function tryProactiveRefresh() {
    const currentToken = sessionStorage.getItem('token');
    if (!currentToken) return;
    if (!isTokenExpiringSoon(currentToken)) return;

    const sessionRefresh = sessionStorage.getItem('refresh_token');
    const cookieRefresh = getRefreshCookie();
    const refreshToken = sessionRefresh || cookieRefresh;
    if (!refreshToken) return;

    try {
      const result = await doRefresh(refreshToken);
      const currentUser = sessionStorage.getItem('user');
      const u: AuthUser = currentUser ? JSON.parse(currentUser) : user!;
      if (cookieRefresh && !sessionRefresh) {
        setAuth(result.access_token, u, result.refresh_token, true);
      } else {
        setAuth(result.access_token, u, result.refresh_token, false);
      }
    } catch {
      logout();
    }
  }

  useEffect(() => {
    async function initAuth() {
      const storedToken = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      const storedRefresh = sessionStorage.getItem('refresh_token');

      if (storedToken && !isTokenExpired(storedToken) && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setRefreshing(false);
        return;
      }

      const cookieRefresh = getRefreshCookie();
      if (cookieRefresh) {
        try {
          const result = await doRefresh(cookieRefresh);
          const parsedUser = storedUser ? JSON.parse(storedUser) : parseTokenUser(result.access_token);
          if (parsedUser) {
            setAuth(result.access_token, parsedUser, result.refresh_token, true);
          }
        } catch {
          clearRefreshCookie();
        }
      } else if (storedRefresh) {
        try {
          const result = await doRefresh(storedRefresh);
          const parsedUser = storedUser ? JSON.parse(storedUser) : parseTokenUser(result.access_token);
          if (parsedUser) {
            setAuth(result.access_token, parsedUser, result.refresh_token, false);
          }
        } catch {
          sessionStorage.removeItem('refresh_token');
        }
      }

      setRefreshing(false);
    }

    initAuth();
  }, []);

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

function parseTokenUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.sub || !payload.email) return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
