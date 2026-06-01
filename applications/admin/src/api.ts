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
  window.location.href = '/login?return_to=' + encodeURIComponent(window.location.pathname);
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

  const url = path.startsWith('/v1') ? `${API_URL}${path}` : `${API_URL}/v1${path}`;
  const res = await fetch(url, {
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUser {
  id: string;
  email: string;
  isPlatformAdmin: boolean;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  organizations: { orgId: string; orgName: string; orgSlug: string; role: string }[];
}

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface AdminOrgDetail extends AdminOrg {
  members: { userId: string; email: string; role: string }[];
  projects: { id: string; name: string; slug: string; createdAt: string }[];
}

export interface AdminProject {
  id: string;
  name: string;
  slug: string;
  orgId: string;
  orgName: string;
  createdAt: string;
}

export interface AdminProjectDetail extends AdminProject {
  repositories: { id: string; name: string; slug: string; gitRemote: string; createdAt: string }[];
}

export interface AdminSearchRequest {
  id: string;
  projectId: string;
  projectName: string | null;
  orgName: string | null;
  question: string;
  reasoningRequested: boolean;
  iters: number;
  pagesRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  stopReason: string;
  answerBrief: string;
  answerReasoning: string | null;
  sources: string[];
  createdAt: string;
}

export interface ProjectUsage {
  searchRequests: {
    id: string;
    question: string;
    reasoningRequested: boolean;
    iters: number;
    pagesRead: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    durationMs: number;
    stopReason: string;
    answerBrief: string;
    answerReasoning: string | null;
    sources: string[];
    createdAt: string;
  }[];
  tokenUsage: {
    id: string;
    searchRequestId: string | null;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    provider: string;
    createdAt: string;
  }[];
}

export interface MeResponse {
  id: string;
  email: string;
  isPlatformAdmin: boolean;
}

export const api = {
  me: () => request<MeResponse>('/auth/me'),

  admin: {
    users: {
      list: (limit = 50, offset = 0) =>
        request<PaginatedResponse<AdminUser>>(`/admin/users?limit=${limit}&offset=${offset}`),
      detail: (id: string) =>
        request<AdminUserDetail>(`/admin/users/${id}`),
    },
    orgs: {
      list: (limit = 50, offset = 0) =>
        request<PaginatedResponse<AdminOrg>>(`/admin/orgs?limit=${limit}&offset=${offset}`),
      detail: (id: string) =>
        request<AdminOrgDetail>(`/admin/orgs/${id}`),
    },
    projects: {
      list: (limit = 50, offset = 0) =>
        request<PaginatedResponse<AdminProject>>(`/admin/projects?limit=${limit}&offset=${offset}`),
      detail: (id: string) =>
        request<AdminProjectDetail>(`/admin/projects/${id}`),
      usage: (id: string) =>
        request<ProjectUsage>(`/admin/projects/${id}/usage`),
    },
    searchRequests: {
      list: (params: { limit?: number; offset?: number; orgId?: string; projectId?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit !== undefined) qs.set('limit', String(params.limit));
        if (params.offset !== undefined) qs.set('offset', String(params.offset));
        if (params.orgId) qs.set('orgId', params.orgId);
        if (params.projectId) qs.set('projectId', params.projectId);
        return request<PaginatedResponse<AdminSearchRequest>>(`/admin/search-requests?${qs.toString()}`);
      },
    },
  },
};
