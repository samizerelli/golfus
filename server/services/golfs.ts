import type {
  GolfDetail,
  GolfEditable,
  GolfSummary,
  GolfsResponse,
  PriceRow,
  Rating,
  Review,
} from '../../shared/types.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { haversineKm, round } from '../lib/geo.ts';
import { golfById, golfsAround, parseOsmId, type OsmGolf } from './osm.ts';

interface GolfRow {
  id: string;
  name: string | null;
  lat: number | null;
  lon: number | null;
  is_demo: number;
  holes: number | null;
  par: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  pricing_url: string | null;
  address: string | null;
  opening_hours: string | null;
  description: string;
  photos: string;
  courses: string;
  services: string;
  price_reliability: string;
  price_updated_at: string | null;
  high_season_months: string;
}

interface PriceDbRow {
  golf_id: string;
  category: string;
  season: string;
  day_type: string;
  amount: number;
  currency: string;
  note: string | null;
}

const json = <T>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

function rowsByIds(ids: string[]): Map<string, GolfRow> {
  if (!ids.length) return new Map();
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM golfs WHERE id IN (${ph})`).all(...ids) as unknown as GolfRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

function pricesByIds(ids: string[]): Map<string, PriceRow[]> {
  const map = new Map<string, PriceRow[]>();
  if (!ids.length) return map;
  const ph = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM prices WHERE golf_id IN (${ph}) ORDER BY id`)
    .all(...ids) as unknown as PriceDbRow[];
  for (const r of rows) {
    const list = map.get(r.golf_id) ?? [];
    list.push({
      category: r.category as PriceRow['category'],
      season: r.season as PriceRow['season'],
      dayType: r.day_type as PriceRow['dayType'],
      amount: r.amount,
      currency: r.currency as PriceRow['currency'],
      note: r.note,
    });
    map.set(r.golf_id, list);
  }
  return map;
}

function ratingsByIds(ids: string[]): Map<string, Rating> {
  const map = new Map<string, Rating>();
  if (!ids.length) return map;
  const ph = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT golf_id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE golf_id IN (${ph}) ${
        config.showDemo ? '' : 'AND is_demo = 0'
      } GROUP BY golf_id`,
    )
    .all(...ids) as { golf_id: string; avg: number; n: number }[];
  for (const r of rows) map.set(r.golf_id, { average: round(r.avg, 1), count: r.n });
  return map;
}

/** Les champs saisis dans la base locale l'emportent sur ceux d'OpenStreetMap. */
function merge(osm: OsmGolf | null, row: GolfRow | undefined, prices: PriceRow[], rating: Rating | null): GolfSummary {
  const pick = <T>(a: T | null | undefined, b: T | null | undefined) => (a ?? b ?? null) as T | null;
  const photos = json<string[]>(row?.photos, []);
  return {
    id: row?.id ?? osm!.id,
    name: pick(row?.name, osm?.name) ?? '',
    lat: pick(row?.lat, osm?.lat)!,
    lon: pick(row?.lon, osm?.lon)!,
    holes: pick(row?.holes, osm?.holes),
    par: pick(row?.par, osm?.par),
    photo: photos[0] ?? osm?.photo ?? null,
    phone: pick(row?.phone, osm?.phone),
    website: pick(row?.website, osm?.website),
    bookingUrl: row?.booking_url ?? null,
    pricingUrl: row?.pricing_url ?? null,
    address: pick(row?.address, osm?.address),
    openingHours: pick(row?.opening_hours, osm?.openingHours),
    rating,
    prices,
    priceReliability: prices.length ? ((row?.price_reliability as GolfSummary['priceReliability']) ?? 'indicative') : 'unknown',
    priceUpdatedAt: row?.price_updated_at ?? null,
    highSeasonMonths: json<number[]>(row?.high_season_months, []),
    services: json(row?.services, {}),
    isDemo: !!row?.is_demo,
    curated: !!row,
  };
}

export async function searchGolfs(lat: number, lon: number, radiusKm: number): Promise<GolfsResponse> {
  let osm: OsmGolf[] = [];
  let stale = false;
  let osmUnavailable = false;
  try {
    const res = await golfsAround(lat, lon, radiusKm);
    osm = res.value;
    stale = res.stale;
  } catch {
    osmUnavailable = true;
  }

  osm = osm.filter((g) => haversineKm(lat, lon, g.lat, g.lon) <= radiusKm);
  // Les polygones OSM sans nom situés à moins de 2 km d'un golf nommé sont généralement des
  // morceaux de ce même golf (trous, practice) : on les écarte pour éviter les doublons.
  const named = osm.filter((g) => g.name);
  osm = osm.filter((g) => g.name || !named.some((n) => haversineKm(n.lat, n.lon, g.lat, g.lon) < 2));

  // Golfs saisis manuellement (démo ou ajouts) dans la zone : recherche par boîte englobante
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const manual = (
    db
      .prepare(
        `SELECT * FROM golfs WHERE id NOT LIKE 'osm-%' AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ${
          config.showDemo ? '' : 'AND is_demo = 0'
        }`,
      )
      .all(lat - dLat, lat + dLat, lon - dLon, lon + dLon) as unknown as GolfRow[]
  ).filter((r) => haversineKm(lat, lon, r.lat!, r.lon!) <= radiusKm);

  const ids = [...osm.map((g) => g.id), ...manual.map((r) => r.id)];
  const rows = rowsByIds(osm.map((g) => g.id));
  for (const m of manual) rows.set(m.id, m);
  const prices = pricesByIds(ids);
  const ratings = ratingsByIds(ids);

  const golfs = [
    ...osm.map((g) => merge(g, rows.get(g.id), prices.get(g.id) ?? [], ratings.get(g.id) ?? null)),
    ...manual.map((r) => merge(null, r, prices.get(r.id) ?? [], ratings.get(r.id) ?? null)),
  ]
    .map((g) => ({ ...g, distanceKm: round(haversineKm(lat, lon, g.lat, g.lon), 1) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { golfs, stale, osmUnavailable };
}

export function getReviews(id: string): Review[] {
  return db
    .prepare(
      `SELECT id, author, rating, comment, created_at AS createdAt FROM reviews WHERE golf_id = ? ${
        config.showDemo ? '' : 'AND is_demo = 0'
      } ORDER BY created_at DESC LIMIT 100`,
    )
    .all(id) as unknown as Review[];
}

export async function getGolf(id: string): Promise<GolfDetail | null> {
  const row = rowsByIds([id]).get(id);
  if (row?.is_demo && !config.showDemo) return null;
  let osm: OsmGolf | null = null;
  if (parseOsmId(id)) {
    try {
      osm = await golfById(id);
    } catch (err) {
      if (!row) throw err;
    }
  }
  if (!osm && (!row || row.lat == null)) return null;
  const prices = pricesByIds([id]).get(id) ?? [];
  const rating = ratingsByIds([id]).get(id) ?? null;
  const base = merge(osm, row, prices, rating);
  const photos = json<string[]>(row?.photos, []);
  const description = json<GolfDetail['description']>(row?.description, {});
  if (!description.fr && !description.en && !description.es && osm?.description) description.fr = osm.description;
  return {
    ...base,
    description,
    photos: photos.length ? photos : osm?.photo ? [osm.photo] : [],
    courses: json(row?.courses, []),
    email: row?.email ?? osm?.email ?? null,
    reviews: getReviews(id),
    osmUrl: osm?.osmUrl ?? null,
  };
}

// ───────── Administration ─────────

export function listCurated() {
  return db
    .prepare(
      `SELECT g.id, g.name, g.is_demo AS isDemo, g.price_reliability AS priceReliability, g.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM prices p WHERE p.golf_id = g.id) AS priceCount
       FROM golfs g ORDER BY g.updated_at DESC`,
    )
    .all();
}

/** Données éditables : la ligne locale si elle existe, sinon un brouillon pré-rempli depuis OSM. */
export async function getEditable(id: string): Promise<{ golf: GolfEditable; osm: OsmGolf | null } | null> {
  const row = rowsByIds([id]).get(id);
  let osm: OsmGolf | null = null;
  if (parseOsmId(id)) osm = await golfById(id).catch(() => null);
  if (!row && !osm) return null;
  const prices = pricesByIds([id]).get(id) ?? [];
  const golf: GolfEditable = row
    ? {
        id,
        name: row.name,
        lat: row.lat,
        lon: row.lon,
        isDemo: !!row.is_demo,
        holes: row.holes,
        par: row.par,
        phone: row.phone,
        email: row.email,
        website: row.website,
        bookingUrl: row.booking_url,
        pricingUrl: row.pricing_url,
        address: row.address,
        openingHours: row.opening_hours,
        description: json(row.description, {}),
        photos: json(row.photos, []),
        courses: json(row.courses, []),
        services: json(row.services, {}),
        priceReliability: row.price_reliability as GolfEditable['priceReliability'],
        priceUpdatedAt: row.price_updated_at,
        highSeasonMonths: json(row.high_season_months, []),
        prices,
      }
    : {
        id,
        name: null,
        lat: null,
        lon: null,
        isDemo: false,
        holes: null,
        par: null,
        phone: null,
        email: null,
        website: null,
        bookingUrl: null,
        pricingUrl: null,
        address: null,
        openingHours: null,
        description: {},
        photos: [],
        courses: [],
        services: {},
        priceReliability: 'indicative',
        priceUpdatedAt: null,
        highSeasonMonths: [],
        prices: [],
      };
  return { golf, osm };
}

export function saveGolf(g: GolfEditable) {
  const nul = <T>(v: T | '' | undefined) => (v === '' || v === undefined ? null : v);
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO golfs (id, name, lat, lon, is_demo, holes, par, phone, email, website, booking_url, pricing_url, address,
         opening_hours, description, photos, courses, services, price_reliability, price_updated_at, high_season_months, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, lat=excluded.lat, lon=excluded.lon, is_demo=excluded.is_demo,
         holes=excluded.holes, par=excluded.par, phone=excluded.phone, email=excluded.email, website=excluded.website,
         booking_url=excluded.booking_url, pricing_url=excluded.pricing_url, address=excluded.address,
         opening_hours=excluded.opening_hours, description=excluded.description, photos=excluded.photos,
         courses=excluded.courses, services=excluded.services, price_reliability=excluded.price_reliability,
         price_updated_at=excluded.price_updated_at, high_season_months=excluded.high_season_months, updated_at=datetime('now')`,
    ).run(
      g.id,
      nul(g.name),
      nul(g.lat),
      nul(g.lon),
      g.isDemo ? 1 : 0,
      nul(g.holes),
      nul(g.par),
      nul(g.phone),
      nul(g.email),
      nul(g.website),
      nul(g.bookingUrl),
      nul(g.pricingUrl),
      nul(g.address),
      nul(g.openingHours),
      JSON.stringify(g.description ?? {}),
      JSON.stringify(g.photos ?? []),
      JSON.stringify(g.courses ?? []),
      JSON.stringify(g.services ?? {}),
      g.priceReliability,
      nul(g.priceUpdatedAt),
      JSON.stringify(g.highSeasonMonths ?? []),
    );
    db.prepare('DELETE FROM prices WHERE golf_id = ?').run(g.id);
    const ins = db.prepare(
      'INSERT INTO prices (golf_id, category, season, day_type, amount, currency, note) VALUES (?,?,?,?,?,?,?)',
    );
    for (const p of g.prices ?? []) ins.run(g.id, p.category, p.season, p.dayType, p.amount, p.currency, p.note ?? null);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function deleteGolf(id: string) {
  db.prepare('DELETE FROM golfs WHERE id = ?').run(id);
}

export function addReview(golfId: string, author: string, rating: number, comment: string) {
  const r = db
    .prepare('INSERT INTO reviews (golf_id, author, rating, comment) VALUES (?,?,?,?)')
    .run(golfId, author, rating, comment);
  return Number(r.lastInsertRowid);
}

export function deleteReview(id: number) {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
}
