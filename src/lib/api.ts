import type {
  GolfDetail,
  GolfEditable,
  GolfsResponse,
  PlaceSuggestion,
  RadiusKm,
  RatesResponse,
  Review,
  TravelInfo,
} from '../../shared/types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '') + '/api';

export interface Friend {
  id: string;
  name: string | null;
  image: string | null;
  handicapIndex: number | null;
}
export interface OutingInput {
  golfId: string;
  golfName: string;
  golfLat: number | null;
  golfLon: number | null;
  date: string;
  timeFrom: string;
  timeTo: string;
  holes: 9 | 18 | null;
  players: number;
  message: string | null;
  friendIds: string[];
}
export interface Outing {
  id: string;
  organizer: { id: string; name: string | null };
  isOrganizer: boolean;
  golf: { id: string; name: string; lat: number | null; lon: number | null };
  date: string;
  timeFrom: string;
  timeTo: string;
  holes: number | null;
  players: number;
  message: string | null;
  status: 'active' | 'cancelled';
  createdAt: string;
  shareToken?: string;
  myResponse: 'pending' | 'yes' | 'maybe' | 'no' | null;
  guests: { id?: string; userId?: string | null; name: string | null; image?: string | null; external: boolean; response: 'pending' | 'yes' | 'maybe' | 'no' }[];
}
export interface Notification {
  id: number;
  type: 'friend_request' | 'friend_accepted' | 'outing_invite' | 'outing_response' | 'outing_cancelled';
  payload: Record<string, string | boolean | undefined>;
  readAt: string | null;
  createdAt: string;
}

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  handicapIndex: number | null;
  lang: string;
  role: 'user' | 'admin';
  hasPassword: boolean;
  providers: string[];
  createdAt: string;
}

/**
 * Appels Auth.js : jeton CSRF puis POST de formulaire. L'en-tête « X-Auth-Return-Redirect » fait renvoyer
 * l'URL de redirection en JSON au lieu d'une redirection HTTP.
 */
async function authPost(path: string, fields: Record<string, string>) {
  const { csrfToken } = (await fetch(`${BASE}/auth/csrf`, { credentials: 'include' }).then((r) => r.json())) as { csrfToken: string };
  const res = await fetch(`${BASE}/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ ...fields, csrfToken }),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  const error = data.url ? new URL(data.url, location.origin).searchParams.get('error') : 'network';
  return { ok: res.ok && !error, error, url: data.url };
}

export const auth = {
  signInPassword: (email: string, password: string) => authPost('callback/credentials', { email, password, callbackUrl: location.origin + '/profil' }),
  sendMagicLink: (email: string, callbackUrl: string) => authPost('signin/email', { email, callbackUrl }),
  signOut: () => authPost('signout', { callbackUrl: location.origin + '/' }),
  /** Google / Apple : redirection complète du navigateur (formulaire POST avec jeton CSRF) */
  async oauth(provider: 'google' | 'apple') {
    const { csrfToken } = (await fetch(`${BASE}/auth/csrf`, { credentials: 'include' }).then((r) => r.json())) as { csrfToken: string };
    const form = Object.assign(document.createElement('form'), { method: 'POST', action: `${BASE}/auth/signin/${provider}` });
    for (const [name, value] of Object.entries({ csrfToken, callbackUrl: location.origin + '/profil' }))
      form.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name, value }));
    document.body.appendChild(form);
    form.submit();
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...init,
      // En-tête anti-CSRF exigé par le serveur pour toute modification
      headers: { 'Content-Type': 'application/json', 'X-GF-CSRF': '1', ...init?.headers },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'error');
  }
  return res.json() as Promise<T>;
}

const q = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)]));

export const api = {
  golfs: (lat: number, lon: number, radius: RadiusKm, signal?: AbortSignal) =>
    request<GolfsResponse>(`/golfs?${q({ lat, lon, radius })}`, { signal }),
  golf: (id: string) => request<GolfDetail>(`/golfs/${encodeURIComponent(id)}`),
  travel: (lat: number, lon: number, destinations: { id: string; lat: number; lon: number }[]) =>
    request<TravelInfo[]>('/travel', { method: 'POST', body: JSON.stringify({ lat, lon, destinations }) }),
  autocomplete: (text: string, lang: string, signal?: AbortSignal) =>
    request<PlaceSuggestion[]>(`/geocode/autocomplete?${q({ q: text, lang })}`, { signal }),
  reverse: (lat: number, lon: number, lang: string) =>
    request<{ label: string | null }>(`/geocode/reverse?${q({ lat, lon, lang })}`),
  rates: () => request<RatesResponse>('/rates'),
  geoip: () => request<{ lat: number; lon: number; city: string | null; country: string | null }>('/geoip'),
  addReview: (id: string, body: { author: string; rating: number; comment: string }) =>
    request<{ id: number }>(`/golfs/${encodeURIComponent(id)}/reviews`, { method: 'POST', body: JSON.stringify(body) }),

  me: () => request<{ user: Me | null }>('/me'),
  authProviders: () => request<{ credentials: boolean; email: boolean; google: boolean; apple: boolean }>('/auth-providers'),
  register: (body: { email: string; password: string; name: string; lang: string; terms: true }) =>
    request<{ ok: true }>('/account/register', { method: 'POST', body: JSON.stringify(body) }),
  updateMe: (body: Partial<{ name: string; handicapIndex: number | null; lang: string }>) =>
    request<{ user: Me }>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  setAvatar: (dataUrl: string | null) => request<{ user: Me }>('/me/avatar', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  changePassword: (body: { current?: string; next: string }) =>
    request<{ ok: true }>('/me/password', { method: 'POST', body: JSON.stringify(body) }),
  logoutAll: () => request<{ ok: true }>('/me/logout-all', { method: 'POST' }),
  deleteMe: (confirmEmail: string) => request<{ ok: true }>('/me', { method: 'DELETE', body: JSON.stringify({ confirmEmail }) }),
  exportUrl: () => BASE + '/me/export',

  // ───── Amis, parties, notifications ─────
  friends: () => request<{ friends: Friend[]; incoming: Friend[]; outgoing: Friend[] }>('/friends'),
  searchUsers: (q: string) => request<Friend[]>(`/users/search?${new URLSearchParams({ q })}`),
  requestFriend: (userId: string) => request<{ status: string }>('/friends/request', { method: 'POST', body: JSON.stringify({ userId }) }),
  acceptFriend: (id: string) => request<{ ok: true }>(`/friends/${id}/accept`, { method: 'POST' }),
  removeFriend: (id: string) => request<{ ok: true }>(`/friends/${id}`, { method: 'DELETE' }),
  createOuting: (body: OutingInput) => request<Outing>('/outings', { method: 'POST', body: JSON.stringify(body) }),
  outings: () => request<Outing[]>('/outings'),
  respondOuting: (id: string, response: 'yes' | 'maybe' | 'no') =>
    request<Outing>(`/outings/${id}/respond`, { method: 'POST', body: JSON.stringify({ response }) }),
  cancelOuting: (id: string) => request<{ ok: true }>(`/outings/${id}/cancel`, { method: 'POST' }),
  invitation: (token: string) => request<Outing>(`/invitations/${encodeURIComponent(token)}`),
  respondInvitation: (token: string, body: { name: string; response: 'yes' | 'maybe' | 'no'; guestToken?: string }) =>
    request<{ ok: true; guestToken: string }>(`/invitations/${encodeURIComponent(token)}/respond`, { method: 'POST', body: JSON.stringify(body) }),
  notifications: () => request<{ unread: number; items: Notification[] }>('/notifications'),
  readNotifications: () => request<{ ok: true }>('/notifications/read', { method: 'POST' }),

  admin: {
    session: () => request<{ configured: boolean; admin: boolean }>('/admin/session'),
    login: (password: string) => request<{ ok: true }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
    logout: () => request<{ ok: true }>('/admin/logout', { method: 'POST' }),
    list: () =>
      request<{ id: string; name: string | null; isDemo: number; priceReliability: string; updatedAt: string; priceCount: number }[]>(
        '/admin/golfs',
      ),
    get: (id: string) =>
      request<{ golf: GolfEditable; osm: Record<string, unknown> | null; reviews: Review[] }>(
        `/admin/golfs/${encodeURIComponent(id)}`,
      ),
    save: (golf: GolfEditable) =>
      request<{ ok: true }>(`/admin/golfs/${encodeURIComponent(golf.id)}`, { method: 'PUT', body: JSON.stringify(golf) }),
    create: (golf: Partial<GolfEditable>) => request<{ id: string }>('/admin/golfs', { method: 'POST', body: JSON.stringify(golf) }),
    remove: (id: string) => request<{ ok: true }>(`/admin/golfs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    deleteReview: (id: number) => request<{ ok: true }>(`/admin/reviews/${id}`, { method: 'DELETE' }),
    users: (q = '') =>
      request<{ id: string; email: string; name: string | null; role: 'user' | 'admin'; createdAt: string; lastLoginAt: string | null; hasPassword: boolean }[]>(
        `/admin/users?${new URLSearchParams({ q })}`,
      ),
    resetPassword: (id: string) => request<{ temporaryPassword: string }>(`/admin/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
    setRole: (id: string, role: 'user' | 'admin') =>
      request<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
    deleteUser: (id: string) => request<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    validateHours: (value: string) =>
      request<{ valid: boolean }>('/admin/validate-hours', { method: 'POST', body: JSON.stringify({ value }) }),
  },
};
