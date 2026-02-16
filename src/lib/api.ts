const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.message || String(err));
  }
  return res.json().catch(() => ({} as T));
}

export async function register(username: string, password: string, email = '') {
  return api<{ user_id: number; username: string }>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, password, email }),
  });
}

export async function getToken(username: string, password: string) {
  return api<{ access: string; refresh: string }>('/auth/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe(token: string) {
  return api<{ username: string; display_name: string }>('/auth/me/', { token });
}

export async function createReport(
  token: string,
  reportedUserId: number,
  reason: string,
  description?: string,
  sessionId?: string
) {
  return api<{ id: number }>('/reports/', {
    method: 'POST',
    token,
    body: JSON.stringify({
      reported_user: reportedUserId,
      reason,
      description: description || '',
      session_id: sessionId || '',
    }),
  });
}
