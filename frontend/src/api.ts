import type { AccessLevel, AccessRequest, Action, Application, Detail, User } from './types';

let csrf: { token: string; headerName: string } | null = null;
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function refreshCsrf() {
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError('Unable to connect to the server.', res.status);
  csrf = await res.json();
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== 'GET') {
    if (!csrf) await refreshCsrf();
    headers.set(csrf!.headerName, csrf!.token);
  }
  let res: Response;
  try { res = await fetch('/api' + url, { ...options, headers, credentials: 'same-origin' }); }
  catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', 0); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
    if (res.status === 403) csrf = null;
    throw new ApiError(body.message || 'The request could not be completed.', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
export const api = {
  me: () => request<User>('/auth/me'),
  login: async (email: string, password: string) => {
    await refreshCsrf();
    await request('/auth/login', { method: 'POST', body: new URLSearchParams({ username: email.trim().toLowerCase(), password }) });
    await refreshCsrf();
    return api.me();
  },
  logout: async () => { await request('/auth/logout', { method: 'POST' }); csrf = null; },
  applications: () => request<Application[]>('/applications'),
  requests: (scope: 'mine' | 'pending') => request<AccessRequest[]>('/requests?scope=' + scope),
  detail: (id: string) => request<Detail>('/requests/' + encodeURIComponent(id)),
  create: (input: { applicationId: string; accessLevel: AccessLevel; justification: string }) => request<Detail>('/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  decide: (id: string, action: Action, comment: string) => request<Detail>('/requests/' + encodeURIComponent(id) + '/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }) }),
};
