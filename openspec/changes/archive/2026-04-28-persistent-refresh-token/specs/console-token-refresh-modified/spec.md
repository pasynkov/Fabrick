# Console Token Refresh - Modified for Persistent Login

## Overview

Enhances the existing console token refresh mechanism to support both sessionStorage and httpOnly cookie storage for refresh tokens, based on user's persistent login choice.

## Modifications to Existing Capability

This specification modifies the existing `console-token-refresh` capability to:

1. Support reading refresh tokens from both sessionStorage and httpOnly cookies
2. Handle token refresh for both storage mechanisms
3. Maintain storage consistency during refresh operations
4. Detect storage method automatically on startup

## Updated Requirements

### Requirement: Dual-mode token refresh mechanism
The console application SHALL automatically refresh access tokens when they have less than 5 minutes remaining before expiration. It SHALL support refresh tokens stored in both sessionStorage and httpOnly cookies, with automatic detection of the storage method.

#### Scenario: Proactive token refresh with sessionStorage
- **WHEN** the access token has less than 5 minutes until expiration AND refresh token is in sessionStorage
- **THEN** the console calls refresh endpoint with token from sessionStorage and updates sessionStorage

#### Scenario: Proactive token refresh with httpOnly cookies
- **WHEN** the access token has less than 5 minutes until expiration AND refresh token is in httpOnly cookie
- **THEN** the console calls refresh endpoint (cookie included automatically) and updates access token in sessionStorage

### Requirement: Startup token detection and restoration
The console application SHALL check for existing authentication on startup by examining both sessionStorage and httpOnly cookies. It SHALL prioritize valid access tokens but fall back to refresh tokens when access tokens are expired or missing.

#### Scenario: Startup with valid sessionStorage tokens
- **WHEN** the application starts AND valid access token exists in sessionStorage
- **THEN** the console uses sessionStorage-based authentication

#### Scenario: Startup with expired sessionStorage but valid refresh cookie
- **WHEN** the application starts AND access token is expired/missing BUT valid refresh token cookie exists
- **THEN** the console automatically refreshes using the cookie and establishes session

#### Scenario: Startup with no valid tokens
- **WHEN** the application starts AND no valid tokens exist in either storage
- **THEN** the console redirects to login page

### Requirement: Storage-aware token refresh API calls
The console application SHALL make refresh API calls with appropriate credentials inclusion and handle responses based on the storage method used.

#### Scenario: SessionStorage refresh API call
- **WHEN** refreshing tokens stored in sessionStorage
- **THEN** include refresh token in request body and update sessionStorage with response

#### Scenario: Cookie-based refresh API call
- **WHEN** refreshing tokens stored in cookies
- **THEN** make request with cookies included, update only access token in sessionStorage

### Requirement: Consistent logout across storage methods
The console application SHALL clear all authentication data on logout, regardless of the storage method used.

#### Scenario: Logout with sessionStorage tokens
- **WHEN** user logs out with sessionStorage-based authentication
- **THEN** clear sessionStorage and make logout API call

#### Scenario: Logout with cookie-based tokens
- **WHEN** user logs out with cookie-based authentication
- **THEN** clear sessionStorage AND make logout API call to clear httpOnly cookies

## Implementation Updates

### AuthProvider Component Updates
```typescript
// Modified AuthProvider to handle dual storage
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storageType, setStorageType] = useState<'session' | 'persistent'>('session');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modified setAuth to handle storage type
  function setAuth(t: string, u: AuthUser, refreshToken?: string, persistent?: boolean) {
    sessionStorage.setItem('token', t);
    sessionStorage.setItem('user', JSON.stringify(u));
    
    if (persistent && refreshToken) {
      // Frontend manages cookie — set via document.cookie
      setRefreshCookie(refreshToken);
      setStorageType('persistent');
    } else {
      setStorageType('session');
    }
    
    setToken(t);
    setUser(u);
  }

  // Enhanced logout to handle both storage types
  function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    clearRefreshCookie(); // Frontend clears cookie via document.cookie
    setToken(null);
    setUser(null);
    
    api.logout(); // Notify backend (optional, for server-side session cleanup)
    
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  // Enhanced refresh function to handle both storage types
  async function tryProactiveRefresh() {
    const currentToken = sessionStorage.getItem('token');
    if (!currentToken) return;
    if (!isTokenExpiringSoon(currentToken)) return;

    setRefreshing(true);
    try {
      let result;
      if (storageType === 'persistent') {
        const refreshToken = getRefreshCookie();
        if (!refreshToken) throw new Error('No refresh token cookie');
        result = await doRefresh(refreshToken);
        setRefreshCookie(result.refresh_token); // Update cookie with rotated token
      } else {
        throw new Error('No persistent session');
      }
      
      sessionStorage.setItem('token', result.access_token);
      setToken(result.access_token);
    } catch {
      logout();
    } finally {
      setRefreshing(false);
    }
  }

  // Enhanced startup logic
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      
      if (storedToken && !isTokenExpired(storedToken) && storedUser) {
        // Valid session storage tokens
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setStorageType('session');
        return;
      }
      
      // Check for persistent cookie via document.cookie
      const refreshToken = getRefreshCookie();
      if (refreshToken) {
        try {
          setRefreshing(true);
          const result = await doRefresh(refreshToken);
          setAuth(result.access_token, result.user, result.refresh_token, true);
        } catch {
          clearRefreshCookie();
          logout();
        } finally {
          setRefreshing(false);
        }
      } else {
        // No valid authentication found
        logout();
      }
    };
    
    initAuth();
  }, []);

  // Rest of component remains similar...
}
```

### Token Refresh Utility Updates
```typescript
// doRefresh always sends token in body (frontend reads from cookie before calling)
export async function doRefresh(refreshToken: string) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Refresh failed');
  }

  return response.json();
}

// Enhanced token expiration check
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;
    
    // Refresh if less than 5 minutes remaining
    return timeUntilExpiration < 5 * 60 * 1000;
  } catch {
    return true; // If we can't parse, assume it's expiring
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000;
    return Date.now() > expirationTime;
  } catch {
    return true;
  }
}
```

### API Client Updates
```typescript
// API client for logout and refresh
class ApiClient {
  async logout() {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });
    
    // Don't throw on error - logout should always succeed locally
    return response.ok;
  }
  
  // Refresh always requires token in body
  async refresh(refreshToken: string) {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }
}
```

## Testing Updates

### New Test Scenarios
```typescript
describe('Enhanced Token Refresh', () => {
  describe('Startup Authentication', () => {
    it('uses sessionStorage when valid tokens exist', async () => {
      sessionStorage.setItem('token', validToken);
      sessionStorage.setItem('user', JSON.stringify(testUser));
      
      render(<AuthProvider><TestComponent /></AuthProvider>);
      
      expect(screen.getByText('Authenticated')).toBeInTheDocument();
    });

    it('attempts cookie refresh when sessionStorage expired', async () => {
      sessionStorage.setItem('token', expiredToken);
      
      // Mock successful cookie-based refresh
      mockApiCall('/api/auth/refresh', { access_token: newToken });
      
      render(<AuthProvider><TestComponent /></AuthProvider>);
      
      await waitFor(() => {
        expect(screen.getByText('Authenticated')).toBeInTheDocument();
      });
    });

    it('redirects to login when no valid authentication', async () => {
      sessionStorage.clear();
      
      // Mock failed cookie-based refresh
      mockApiCall('/api/auth/refresh', null, 401);
      
      render(<AuthProvider><TestComponent /></AuthProvider>);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Token Refresh Flow', () => {
    it('refreshes sessionStorage tokens correctly', async () => {
      // Test sessionStorage refresh flow
    });

    it('refreshes cookie-based tokens correctly', async () => {
      // Test cookie refresh flow
    });
  });

  describe('Logout Flow', () => {
    it('clears sessionStorage and calls logout API', async () => {
      // Test logout with both storage types
    });
  });
});
```

## Migration Notes

### From Current Implementation
The current implementation using only sessionStorage will automatically work with the new dual-mode system. Users with existing sessionStorage tokens will continue to use sessionStorage until they log out and choose persistent login.

### Backward Compatibility
The enhanced implementation maintains full backward compatibility with the existing sessionStorage approach while adding support for cookie-based authentication.