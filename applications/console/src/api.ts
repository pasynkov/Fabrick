import { clearRefreshCookie, doRefresh, getRefreshCookie, isTokenExpiringSoon, setRefreshCookie } from './tokenRefresh';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

function getRefreshToken(): string | null {
  return sessionStorage.getItem('refresh_token') || getRefreshCookie();
}

function storeTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem('token', accessToken);
  const hasCookie = !!getRefreshCookie();
  if (hasCookie) {
    setRefreshCookie(refreshToken);
  } else {
    sessionStorage.setItem('refresh_token', refreshToken);
  }
}

function clearAuth() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('refresh_token');
  clearRefreshCookie();
  window.location.href = '/login';
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const result = await doRefresh(refreshToken);
    storeTokens(result.access_token, result.refresh_token);
    return result.access_token;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let token = getToken();

  if (token && isTokenExpiringSoon(token)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = refreshed;
    } else {
      clearAuth();
      throw Object.assign(new Error('Session expired'), { status: 401 });
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      clearAuth();
      throw Object.assign(new Error('Session expired'), { status: 401 });
    }
    return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || res.statusText), { status: res.status });
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  register: (email: string, password: string, persistent?: boolean) =>
    request<{ access_token: string; refresh_token?: string; user: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, persistent }),
    }),

  login: (email: string, password: string, persistent?: boolean) =>
    request<{ access_token: string; refresh_token?: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, persistent }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),

  refresh: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  revoke: () =>
    request<void>('/auth/revoke', { method: 'POST', body: '{}' }),

  cliToken: () =>
    request<{ token: string }>('/auth/cli-token', { method: 'POST', body: '{}' }),

  orgs: {
    list: () => request<{ id: string; name: string; slug: string; role: string }[]>('/orgs'),
    create: (name: string) =>
      request<{ id: string; name: string; slug: string }>('/orgs', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    update: (orgId: string, name: string) =>
      request<{ id: string; name: string; slug: string }>(`/orgs/${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    members: {
      list: (orgId: string) =>
        request<{ userId: string; email: string; role: string }[]>(`/orgs/${orgId}/members`),
      add: (orgId: string, email: string, password: string) =>
        request<{ userId: string; email: string; role: string }>(`/orgs/${orgId}/members`, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
    },
  },

  projects: {
    list: (orgId: string) =>
      request<{ id: string; name: string; slug: string }[]>(`/orgs/${orgId}/projects`),
    create: (orgId: string, name: string) =>
      request<{ id: string; name: string; slug: string }>(`/orgs/${orgId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    update: (orgId: string, projectId: string, name: string) =>
      request<{ id: string; name: string; slug: string; orgId: string }>(`/orgs/${orgId}/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
  },

  repos: {
    list: (projectId: string) =>
      request<{ id: string; name: string; slug: string; gitRemote: string }[]>(
        `/projects/${projectId}/repos`,
      ),
  },

  synthesis: {
    trigger: (projectId: string) =>
      request<void>(`/projects/${projectId}/synthesis`, { method: 'POST' }),
    status: (projectId: string) =>
      request<{ status: string; error?: string }>(`/projects/${projectId}/synthesis/status`),
    files: (projectId: string) =>
      request<Record<string, string>>(`/projects/${projectId}/synthesis`),
  },
};
