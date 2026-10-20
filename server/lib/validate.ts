import OpeningHours from 'opening_hours';
import {
  BOOKING_PLATFORMS,
  CURRENCIES,
  PRICE_CATEGORIES,
  SERVICE_KEYS,
  type Course,
  type GolfEditable,
  type PriceRow,
  type Services,
} from '../../shared/types.ts';

const str = (v: unknown, max = 500) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s || null;
};
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const httpUrl = (v: unknown) => {
  const s = str(v, 1000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export function isValidOpeningHours(s: string) {
  try {
    new OpeningHours(s, null, { mode: 0 } as never);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeGolf(id: string, b: Record<string, unknown>): { golf?: GolfEditable; error?: string } {
  const openingHours = str(b.openingHours, 500);
  if (openingHours && !isValidOpeningHours(openingHours)) return { error: 'invalid_opening_hours' };

  const prices: PriceRow[] = [];
  for (const p of Array.isArray(b.prices) ? b.prices : []) {
    const amount = num(p?.amount, 0, 100000);
    if (amount === null) continue;
    if (!PRICE_CATEGORIES.includes(p.category)) continue;
    prices.push({
      category: p.category,
      season: ['low', 'high', 'all'].includes(p.season) ? p.season : 'all',
      dayType: ['weekday', 'weekend', 'all'].includes(p.dayType) ? p.dayType : 'all',
      amount,
      currency: CURRENCIES.includes(p.currency) ? p.currency : 'EUR',
      note: str(p.note, 200),
      fromTime: /^\d{2}:\d{2}$/.test(String(p.fromTime ?? '')) ? String(p.fromTime) : null,
      toTime: /^\d{2}:\d{2}$/.test(String(p.toTime ?? '')) ? String(p.toTime) : null,
      fromDate: /^\d{2}-\d{2}$/.test(String(p.fromDate ?? '')) ? String(p.fromDate) : null,
      toDate: /^\d{2}-\d{2}$/.test(String(p.toDate ?? '')) ? String(p.toDate) : null,
    });
  }

  const services: Services = {};
  const sIn = (b.services ?? {}) as Record<string, unknown>;
  for (const k of SERVICE_KEYS) services[k] = typeof sIn[k] === 'boolean' ? (sIn[k] as boolean) : null;

  const courses: Course[] = (Array.isArray(b.courses) ? b.courses : []).slice(0, 10).map((c) => ({
    name: str(c?.name, 120) ?? '',
    holes: num(c?.holes, 1, 72),
    par: num(c?.par, 1, 300),
    lengthM: num(c?.lengthM, 1, 20000),
    difficulty: ['easy', 'medium', 'hard'].includes(c?.difficulty) ? c.difficulty : null,
  }));

  const desc = (b.description ?? {}) as Record<string, unknown>;
  const isManual = !id.startsWith('osm-');
  const lat = num(b.lat, -90, 90);
  const lon = num(b.lon, -180, 180);
  if (isManual && (lat === null || lon === null || !str(b.name))) return { error: 'manual_requires_name_and_coords' };

  return {
    golf: {
      id,
      name: str(b.name, 200),
      lat,
      lon,
      isDemo: b.isDemo === true,
      holes: num(b.holes, 1, 72),
      par: num(b.par, 1, 300),
      phone: str(b.phone, 40),
      email: str(b.email, 200),
      website: httpUrl(b.website),
      bookingUrl: httpUrl(b.bookingUrl),
      pricingUrl: httpUrl(b.pricingUrl),
      address: str(b.address, 300),
      openingHours,
      description: { fr: str(desc.fr, 5000) ?? undefined, en: str(desc.en, 5000) ?? undefined, es: str(desc.es, 5000) ?? undefined },
      photos: (Array.isArray(b.photos) ? b.photos : []).map(httpUrl).filter((u): u is string => !!u).slice(0, 12),
      courses,
      services,
      priceReliability: ['verified', 'indicative'].includes(b.priceReliability as string)
        ? (b.priceReliability as 'verified' | 'indicative')
        : 'indicative',
      priceUpdatedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(b.priceUpdatedAt ?? '')) ? String(b.priceUpdatedAt) : null,
      offers: (Array.isArray(b.offers) ? b.offers : [])
        .filter((o) => BOOKING_PLATFORMS.includes(o?.platform))
        .slice(0, 10)
        .map((o) => ({
          platform: o.platform,
          ref: str(o.ref, 120),
          amount: num(o.amount, 0, 100000),
          currency: CURRENCIES.includes(o.currency) ? o.currency : 'EUR',
          observedFor: /^\d{4}-\d{2}-\d{2}$/.test(String(o.observedFor ?? '')) ? String(o.observedFor) : null,
          note: str(o.note, 200),
        })),
      highSeasonMonths: (Array.isArray(b.highSeasonMonths) ? b.highSeasonMonths : [])
        .map((m) => num(m, 1, 12))
        .filter((m): m is number => m !== null),
      prices,
    },
  };
}
