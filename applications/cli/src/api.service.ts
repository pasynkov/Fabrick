import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiService {
  async request<T>(
    apiUrl: string,
    path: string,
    token: string | null,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const base = apiUrl.trim().replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).message || `HTTP ${res.status}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async get<T>(apiUrl: string, path: string, token: string): Promise<T> {
    return this.request<T>(apiUrl, path, token);
  }

  async download(apiUrl: string, path: string, token: string): Promise<Buffer> {
    const base = apiUrl.trim().replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).message || `HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async post<T>(
    apiUrl: string,
    path: string,
    token: string | null,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const opts: RequestInit = {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers,
    };
    return this.request<T>(apiUrl, path, token, opts);
  }
}
