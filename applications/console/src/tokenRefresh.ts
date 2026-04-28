const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return false;
  return Date.now() > expiry - REFRESH_THRESHOLD_MS;
}

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return false;
  return Date.now() > expiry;
}

export async function doRefresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || 'Refresh failed'), { status: res.status });
      }
      return res.json() as Promise<{ access_token: string; refresh_token: string }>;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
