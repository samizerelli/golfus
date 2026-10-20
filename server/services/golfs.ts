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

const inList = (ids: string[]) => ids.map(() => '?').join(',');

async function rowsByIds(ids: string[]): Promise<Map<string, GolfRow>> {
  if (!ids.length) return new Map();
  const rows = await db.all<GolfRow>(`SELECT * FROM golfs WHERE id IN (${inList(ids)})`, ...ids);
  return new Map(rows.map((r) => [r.id, r]));
}

async function pricesByIds(ids: string[]): Promise<Map<string, PriceRow[]>> {
  const map = new Map<string, PriceRow[]>();
  if (!ids.length) return map;
  const rows = await db.all<PriceDbRow>(`SELECT * FROM prices WHERE golf_id IN (${inList(ids)}) ORDER BY id`, ...ids);
  for (const r of rows) {
    const list = map.get(r.golf_id) ?? [];
    list.push({
      category: r.category as PriceRow['category'],
      season: r.season as PriceRow['season'],
      dayType: r.day_type as PriceRow['dayType'],
      amount: Number(r.amount),
      currency: r.currency as PriceRow['currency'],
      note: r.note,
    });
    map.set(r.golf_id, list);
  }
  return map;
}

async function ratingsByIds(ids: string[]): Promise<Map<string, Rating>> {
  const map = new Map<string, Rating>();
  if (!ids.length) return map;
  const rows = await db.all<{ golf_id: string; avg: number; n: number }>(
    `SELECT golf_id, AVG(rating)::float AS avg, COUNT(*)::int AS n FROM reviews WHERE golf_id IN (${inList(ids)}) ${
      config.showDemo ? '' : 'AND is_demo = 0'
    } GROUP BY golf_id`,
    ...ids,
  );
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
  // Un golf sans nom, sans site ni téléphone n'est pas exploitable (on ne peut ni l'identifier ni réserver)
  const named = osm.filter((g) => g.name);
  osm = osm.filter((g) => g.name || ((g.website || g.phone) && !named.some((n) => haversineKm(n.lat, n.lon, g.lat, g.lon) < 2)));
  // Un même golf peut être décrit par plusieurs objets OSM (contour + point) : même nom à moins de 1,5 km
  // → on garde l'objet le plus renseigné
  const richness = (g: OsmGolf) => [g.website, g.phone, g.openingHours, g.holes, g.par, g.address, g.photo].filter((v) => v != null).length;
  const norm = (n: string | null) => (n ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // Practices seuls et écoles (on ne peut pas y jouer un parcours)
  osm = osm.filter((g) => !/driving range|range golf|golf lessons|golf academy|practice\b/i.test(g.name ?? ''));
  // Même nom, ou un nom qui prolonge l'autre (« … Golf Club » / « … Golf Clubhouse »), à moins de 1,5 km
  // → on garde l'objet le plus renseigné
  const sameGolf = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 8 && (a.startsWith(b) || b.startsWith(a)));
  const kept: OsmGolf[] = [];
  for (const g of [...osm].sort((a, b) => richness(b) - richness(a))) {
    if (g.name && kept.some((k) => k.name && sameGolf(norm(k.name), norm(g.name)) && haversineKm(k.lat, k.lon, g.lat, g.lon) < 1.5)) continue;
    kept.push(g);
  }
  // Parcours internes d'un complexe (« Course A », « Campo Europa », « Par 3 Course »…) sans site ni téléphone :
  // ils sont présentés par le golf principal voisin
  const generic = (n: string) => /^(course|campo|par 3|parcours|recorrido|pitch)\b/i.test(n) || !/golf|club|country|resort|links/i.test(n);
  osm = kept.filter(
    (g) => !(g.name && !g.website && !g.phone && generic(g.name) && kept.some((k) => k !== g && k.website && haversineKm(k.lat, k.lon, g.lat, g.lon) < 3)),
  );

  // Golfs saisis manuellement (démo ou ajouts) dans la zone : recherche par boîte englobante
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const manual = (
    await db.all<GolfRow>(
      `SELECT * FROM golfs WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ${config.showDemo ? '' : 'AND is_demo = 0'}`,
      lat - dLat,
      lat + dLat,
      lon - dLon,
      lon + dLon,
    )
  )
    // Golfs OSM relevés (fiches vérifiées) : déjà présents si OpenStreetMap a répondu, sinon ajoutés depuis la base
    .filter((r) => !osm.some((g) => g.id === r.id))
    .filter((r) => haversineKm(lat, lon, r.lat!, r.lon!) <= radiusKm);

  const ids = [...osm.map((g) => g.id), ...manual.map((r) => r.id)];
  const [rows, prices, ratings] = await Promise.all([rowsByIds(osm.map((g) => g.id)), pricesByIds(ids), ratingsByIds(ids)]);
  for (const m of manual) rows.set(m.id, m);

  const golfs = [
    ...osm.map((g) => merge(g, rows.get(g.id), prices.get(g.id) ?? [], ratings.get(g.id) ?? null)),
    ...manual.map((r) => merge(null, r, prices.get(r.id) ?? [], ratings.get(r.id) ?? null)),
  ]
    .map((g) => ({ ...g, distanceKm: round(haversineKm(lat, lon, g.lat, g.lon), 1) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { golfs, stale, osmUnavailable };
}

export async function getReviews(id: string): Promise<Review[]> {
  return db.all<Review>(
    `SELECT id, author, rating, comment, created_at AS "createdAt" FROM reviews WHERE golf_id = ? ${
      config.showDemo ? '' : 'AND is_demo = 0'
    } ORDER BY created_at DESC LIMIT 100`,
    id,
  );
}

export async function getGolf(id: string): Promise<GolfDetail | null> {
  const row = (await rowsByIds([id])).get(id);
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
  const [prices, ratings, reviews] = await Promise.all([pricesByIds([id]), ratingsByIds([id]), getReviews(id)]);
  const base = merge(osm, row, prices.get(id) ?? [], ratings.get(id) ?? null);
  const photos = json<string[]>(row?.photos, []);
  const description = json<GolfDetail['description']>(row?.description, {});
  if (!description.fr && !description.en && !description.es && osm?.description) description.fr = osm.description;
  return {
    ...base,
    description,
    photos: photos.length ? photos : osm?.photo ? [osm.photo] : [],
    courses: json(row?.courses, []),
    email: row?.email ?? osm?.email ?? null,
    reviews,
    osmUrl: osm?.osmUrl ?? null,
  };
}

// ───────── Administration ─────────

export async function listCurated() {
  return db.all(
    `SELECT g.id, g.name, g.is_demo AS "isDemo", g.price_reliability AS "priceReliability", g.updated_at AS "updatedAt",
            (SELECT COUNT(*)::int FROM prices p WHERE p.golf_id = g.id) AS "priceCount"
     FROM golfs g ORDER BY g.updated_at DESC`,
  );
}

const EMPTY_EDITABLE = (id: string): GolfEditable => ({
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
});

/** Fiche enregistrée en base uniquement (sans appel à OpenStreetMap), ou null. */
export async function getStoredEditable(id: string): Promise<GolfEditable | null> {
  const row = (await rowsByIds([id])).get(id);
  if (!row) return null;
  const prices = (await pricesByIds([id])).get(id) ?? [];
  return {
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
  };
}

/** Données éditables : la ligne locale si elle existe, sinon un brouillon pré-rempli depuis OSM. */
export async function getEditable(id: string): Promise<{ golf: GolfEditable; osm: OsmGolf | null } | null> {
  const row = (await rowsByIds([id])).get(id);
  let osm: OsmGolf | null = null;
  if (parseOsmId(id)) osm = await golfById(id).catch(() => null);
  if (!row && !osm) return null;
  const prices = (await pricesByIds([id])).get(id) ?? [];
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
    : EMPTY_EDITABLE(id);
  return { golf, osm };
}

export async function saveGolf(g: GolfEditable) {
  const nul = <T>(v: T | '' | undefined) => (v === '' || v === undefined ? null : v);
  await db.tx(async () => {
    await db.run(
      `INSERT INTO golfs (id, name, lat, lon, is_demo, holes, par, phone, email, website, booking_url, pricing_url, address,
         opening_hours, description, photos, courses, services, price_reliability, price_updated_at, high_season_months, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, now())
       ON CONFLICT (id) DO UPDATE SET name=excluded.name, lat=excluded.lat, lon=excluded.lon, is_demo=excluded.is_demo,
         holes=excluded.holes, par=excluded.par, phone=excluded.phone, email=excluded.email, website=excluded.website,
         booking_url=excluded.booking_url, pricing_url=excluded.pricing_url, address=excluded.address,
         opening_hours=excluded.opening_hours, description=excluded.description, photos=excluded.photos,
         courses=excluded.courses, services=excluded.services, price_reliability=excluded.price_reliability,
         price_updated_at=excluded.price_updated_at, high_season_months=excluded.high_season_months, updated_at=now()`,
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
    await db.run('DELETE FROM prices WHERE golf_id = ?', g.id);
    for (const p of g.prices ?? [])
      await db.run(
        'INSERT INTO prices (golf_id, category, season, day_type, amount, currency, note) VALUES (?,?,?,?,?,?,?)',
        g.id,
        p.category,
        p.season,
        p.dayType,
        p.amount,
        p.currency,
        p.note ?? null,
      );
  });
}

export async function deleteGolf(id: string) {
  await db.run('DELETE FROM golfs WHERE id = ?', id);
}

export async function addReview(golfId: string, author: string, rating: number, comment: string) {
  const r = await db.get<{ id: number }>('INSERT INTO reviews (golf_id, author, rating, comment) VALUES (?,?,?,?) RETURNING id', golfId, author, rating, comment);
  return r!.id;
}

export async function deleteReview(id: number) {
  await db.run('DELETE FROM reviews WHERE id = ?', id);
}
