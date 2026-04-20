const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || res.statusText), { status: res.status });
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ access_token: string; user: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  cliToken: () =>
    request<{ token: string }>('/auth/cli-token', { method: 'POST', body: '{}' }),

  orgs: {
    list: () => request<{ id: string; name: string; slug: string; role: string }[]>('/orgs'),
    create: (name: string) =>
      request<{ id: string; name: string; slug: string }>('/orgs', {
        method: 'POST',
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
  },

  repos: {
    list: (projectId: string) =>
      request<{ id: string; name: string; slug: string; gitRemote: string }[]>(
        `/projects/${projectId}/repos`,
      ),
  },
};
