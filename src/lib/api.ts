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
      headers: { 'Content-Type': 'application/json', ...init?.headers },
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
    validateHours: (value: string) =>
      request<{ valid: boolean }>('/admin/validate-hours', { method: 'POST', body: JSON.stringify({ value }) }),
  },
};
