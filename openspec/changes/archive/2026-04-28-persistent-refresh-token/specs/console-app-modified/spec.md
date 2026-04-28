# Console App - Modified for Persistent Login

## Overview

Enhances the existing console application capability to support persistent login choice through UI components and authentication flow modifications.

## Modifications to Existing Capability

This specification modifies the existing `console-app` capability to:

1. Add "Save Login" checkbox to login and register forms
2. Support conditional token storage based on user choice
3. Handle authentication startup with both storage methods
4. Maintain session consistency across browser restarts for persistent logins

## Updated Requirements

### Requirement: Enhanced login page with persistence choice
The console SHALL provide a `/login` page with email, password fields, and a "Save Login" checkbox. When the checkbox is checked, it SHALL request persistent authentication and handle token storage appropriately.

#### Scenario: Login with persistent choice checked
- **WHEN** user checks "Save Login" and submits correct credentials
- **THEN** console stores access token in sessionStorage, refresh token is handled via httpOnly cookie by server, and user is redirected to org list

#### Scenario: Login with persistent choice unchecked (default)
- **WHEN** user submits correct credentials without checking "Save Login"
- **THEN** console stores both tokens in sessionStorage (current behavior) and redirects to org list

#### Scenario: Failed login with any persistence choice
- **WHEN** user submits wrong credentials regardless of checkbox state
- **THEN** console displays error message and stays on login page

### Requirement: Enhanced register page with persistence choice
The console SHALL provide a `/register` page with email, password fields, and a "Save Login" checkbox. The behavior SHALL match the login page persistence handling.

#### Scenario: Registration with persistent choice checked
- **WHEN** user checks "Save Login" and submits valid registration data
- **THEN** account is created, tokens are handled persistently, user is redirected to org list

#### Scenario: Registration with persistent choice unchecked (default)
- **WHEN** user submits valid registration data without checking "Save Login"
- **THEN** account is created with session-based tokens, user is redirected to org list

### Requirement: Enhanced application startup authentication detection
The console SHALL detect existing authentication on application startup by checking both sessionStorage and httpOnly cookies, prioritizing active sessions but falling back to persistent authentication.

#### Scenario: Startup with active session tokens
- **WHEN** user opens console with valid sessionStorage tokens
- **THEN** console uses existing session and continues normally

#### Scenario: Startup with expired session but persistent cookies
- **WHEN** user opens console with expired/missing sessionStorage but valid persistent cookies
- **THEN** console automatically refreshes authentication and establishes new session

#### Scenario: Startup with no valid authentication
- **WHEN** user opens console with no valid tokens in either storage
- **THEN** console redirects to login page

### Requirement: Enhanced CLI auth flow with persistent support
The console SHALL provide a `/cli-auth` page that works with both session and persistent authentication modes. If authentication is expired/missing, it SHALL redirect to login with appropriate return handling.

#### Scenario: CLI auth with persistent authentication
- **WHEN** user visits CLI auth page with persistent authentication active
- **THEN** console uses persistent tokens to generate CLI token and redirects appropriately

#### Scenario: CLI auth requiring token refresh
- **WHEN** user visits CLI auth page with expired access token but valid refresh token (any storage)
- **THEN** console automatically refreshes tokens and continues CLI auth flow

## Implementation Updates

### Enhanced Login Component
```typescript
// Login.tsx - Updated with persistence checkbox
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [persistent, setPersistent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.login(email, password, persistent);
      setAuth(res.access_token, res.user, res.refresh_token, persistent);
      navigate(params.get('next') || '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Sign in</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="persistent-login"
              checked={persistent}
              onChange={(e) => setPersistent(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="persistent-login" className="ml-2 block text-sm text-gray-700">
              Save Login
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Stay signed in across browser sessions
          </p>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white rounded py-2 text-sm font-medium hover:bg-purple-700"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500 text-center">
          No account? <Link to="/register" className="text-purple-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
```

### Enhanced Register Component
```typescript
// Register.tsx - Updated with persistence checkbox
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Register() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [persistent, setPersistent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.register(email, password, persistent);
      setAuth(res.access_token, res.user, res.refresh_token, persistent);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900">Create account</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="persistent-register"
              checked={persistent}
              onChange={(e) => setPersistent(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="persistent-register" className="ml-2 block text-sm text-gray-700">
              Save Login
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Stay signed in across browser sessions
          </p>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white rounded py-2 text-sm font-medium hover:bg-purple-700"
          >
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500 text-center">
          Already have an account? <Link to="/login" className="text-purple-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
```

### Enhanced API Client
```typescript
// api.ts - Updated authentication methods
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '';
  }

  async login(email: string, password: string, persistent?: boolean) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({ email, password, persistent }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  async register(email: string, password: string, persistent?: boolean) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({ email, password, persistent }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  async refresh(refreshToken?: string) {
    const body = refreshToken ? { refresh_token: refreshToken } : {};
    
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    return response.json();
  }

  async logout() {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    // Don't throw on logout failure - always succeed locally
    return response.ok;
  }

  // ... other methods remain unchanged
}
```

### Enhanced AuthProvider
```typescript
// auth.tsx - Updated authentication context
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';

interface AuthUser { id: string; email: string }

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  refreshing: boolean;
  storageType: 'session' | 'persistent';
  setAuth: (token: string, user: AuthUser, refreshToken?: string, persistent?: boolean) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storageType, setStorageType] = useState<'session' | 'persistent'>('session');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setAuth(t: string, u: AuthUser, refreshToken?: string, persistent?: boolean) {
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    
    if (persistent) {
      // Cookie is set by server, just track the storage type
      setStorageType('persistent');
      sessionStorage.removeItem('refresh_token'); // Clean up any old session tokens
    } else {
      sessionStorage.setItem('refresh_token', refreshToken || '');
      setStorageType('session');
    }
    
    setToken(t);
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    setStorageType('session');
    
    // Clear server-side cookies
    api.logout();
    
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  async function tryProactiveRefresh() {
    const currentToken = sessionStorage.getItem('token');
    if (!currentToken) return;
    if (!isTokenExpiringSoon(currentToken)) return;

    setRefreshing(true);
    try {
      let result;
      if (storageType === 'session') {
        const refreshToken = sessionStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        result = await api.refresh(refreshToken);
        sessionStorage.setItem('refresh_token', result.refresh_token);
      } else {
        // Cookie-based refresh
        result = await api.refresh();
      }
      
      sessionStorage.setItem('token', result.access_token);
      setToken(result.access_token);
    } catch {
      logout();
    } finally {
      setRefreshing(false);
    }
  }

  // Initialize authentication on startup
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      const storedRefreshToken = sessionStorage.getItem('refresh_token');
      
      // Check for valid session storage authentication
      if (storedToken && !isTokenExpired(storedToken) && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setStorageType(storedRefreshToken ? 'session' : 'persistent');
        return;
      }
      
      // Try cookie-based authentication if session expired/missing
      if (!storedToken || isTokenExpired(storedToken)) {
        try {
          setRefreshing(true);
          const result = await api.refresh(); // Cookie-based refresh
          
          if (result.access_token) {
            sessionStorage.setItem('token', result.access_token);
            setToken(result.access_token);
            
            // Get user info from token or make additional API call
            const userInfo = parseTokenUser(result.access_token) || storedUser ? JSON.parse(storedUser) : null;
            if (userInfo) {
              sessionStorage.setItem('user', JSON.stringify(userInfo));
              setUser(userInfo);
            }
            
            setStorageType('persistent');
          }
        } catch {
          // No valid authentication found, clear any stale data
          logout();
        } finally {
          setRefreshing(false);
        }
      }
    };
    
    initAuth();
  }, []);

  // Set up automatic refresh interval
  useEffect(() => {
    if (!token) return;
    
    intervalRef.current = setInterval(tryProactiveRefresh, 60 * 1000); // Check every minute
    tryProactiveRefresh(); // Check immediately
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, storageType]);

  return (
    <Ctx.Provider value={{ user, token, refreshing, storageType, setAuth, logout }}>
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
  
  if (refreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }
  
  if (!token) {
    return (
      <Navigate 
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} 
        replace 
      />
    );
  }
  
  return <>{children}</>;
}

// Utility functions
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() > payload.exp * 1000;
  } catch {
    return true;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;
    
    // Refresh if less than 5 minutes remaining
    return timeUntilExpiration < 5 * 60 * 1000;
  } catch {
    return true;
  }
}

function parseTokenUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
```

## Testing Updates

### Component Testing
```typescript
describe('Enhanced Login Component', () => {
  it('renders save login checkbox', () => {
    render(<Login />);
    
    expect(screen.getByLabelText('Save Login')).toBeInTheDocument();
    expect(screen.getByText('Stay signed in across browser sessions')).toBeInTheDocument();
  });

  it('checkbox is unchecked by default', () => {
    render(<Login />);
    
    const checkbox = screen.getByLabelText('Save Login') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('submits with persistent flag when checked', async () => {
    const mockLogin = jest.spyOn(api, 'login').mockResolvedValue({
      access_token: 'token',
      user: { id: '1', email: 'test@example.com' },
    });

    render(<Login />);
    
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByLabelText('Save Login'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', true);
  });

  it('submits without persistent flag when unchecked', async () => {
    const mockLogin = jest.spyOn(api, 'login').mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      user: { id: '1', email: 'test@example.com' },
    });

    render(<Login />);
    
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', false);
  });
});

describe('Enhanced Register Component', () => {
  // Similar tests for register component
});
```

### Authentication Flow Testing
```typescript
describe('Enhanced AuthProvider', () => {
  describe('startup authentication', () => {
    it('uses existing session tokens when valid', () => {
      sessionStorage.setItem('token', validToken);
      sessionStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
      sessionStorage.setItem('refresh_token', 'refresh');

      render(<AuthProvider><TestComponent /></AuthProvider>);

      expect(screen.getByText('session')).toBeInTheDocument(); // storageType
    });

    it('attempts cookie refresh when session expired', async () => {
      sessionStorage.setItem('token', expiredToken);
      
      mockApiCall('/auth/refresh', { access_token: newToken });

      render(<AuthProvider><TestComponent /></AuthProvider>);

      await waitFor(() => {
        expect(screen.getByText('persistent')).toBeInTheDocument();
      });
    });

    it('redirects to login when no authentication available', async () => {
      sessionStorage.clear();
      mockApiCall('/auth/refresh', null, 401);

      render(
        <BrowserRouter>
          <AuthProvider>
            <RequireAuth>
              <div>Protected</div>
            </RequireAuth>
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/login');
      });
    });
  });

  describe('authentication methods', () => {
    it('sets up session storage for non-persistent login', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      act(() => {
        result.current.setAuth('token', { id: '1', email: 'test@example.com' }, 'refresh', false);
      });

      expect(sessionStorage.getItem('refresh_token')).toBe('refresh');
      expect(result.current.storageType).toBe('session');
    });

    it('sets up persistent storage for persistent login', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      });

      act(() => {
        result.current.setAuth('token', { id: '1', email: 'test@example.com' }, undefined, true);
      });

      expect(sessionStorage.getItem('refresh_token')).toBeNull();
      expect(result.current.storageType).toBe('persistent');
    });
  });
});
```

## CSS and Styling

### Checkbox Styling
```css
/* Additional styles for the persistent login checkbox */
.persistent-login-container {
  @apply flex items-center space-x-2 py-2;
}

.persistent-login-checkbox {
  @apply h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded;
}

.persistent-login-label {
  @apply text-sm text-gray-700 font-medium;
}

.persistent-login-description {
  @apply text-xs text-gray-500 italic;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .persistent-login-container {
    @apply flex-col items-start space-x-0 space-y-1;
  }
}
```

## Security Notes

### Client-Side Considerations
- Access tokens remain in sessionStorage for JavaScript access in both modes
- Refresh tokens are only accessible to JavaScript when in session mode
- Persistent mode uses httpOnly cookies that JavaScript cannot access
- Automatic cleanup on logout for both storage methods

### User Experience
- Default to session-based authentication (unchecked checkbox)
- Clear labeling of persistence implications
- Consistent behavior across login and register forms
- Graceful handling of mixed authentication states during startup