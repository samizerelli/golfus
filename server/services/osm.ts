import { config } from '../config.ts';
import { cached } from '../lib/cache.ts';
import { fetchJson, UpstreamError } from '../lib/http.ts';
import { round } from '../lib/geo.ts';
import { nominatimQueue } from '../lib/throttle.ts';

export interface OsmGolf {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  holes: number | null;
  par: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  openingHours: string | null;
  photo: string | null;
  description: string | null;
  osmUrl: string;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const TYPE_PREFIX = { node: 'n', way: 'w', relation: 'r' } as const;
const PREFIX_TYPE = { n: 'node', w: 'way', r: 'relation' } as const;

export function parseOsmId(id: string): { type: 'node' | 'way' | 'relation'; num: number } | null {
  const m = /^osm-([nwr])(\d+)$/.exec(id);
  if (!m) return null;
  return { type: PREFIX_TYPE[m[1] as 'n' | 'w' | 'r'], num: Number(m[2]) };
}

function int(v?: string) {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n < 200 ? n : null;
}

function url(v?: string) {
  if (!v) return null;
  const s = v.split(';')[0].trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function commonsUrl(file: string) {
  const name = file.replace(/^File:/i, '').trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800`;
}

function photoFromTags(t: Record<string, string>) {
  const img = t.image?.trim();
  if (img) {
    const m = /commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/i.exec(img);
    if (m) return commonsUrl(decodeURIComponent(m[1]));
    if (/^File:/i.test(img)) return commonsUrl(img);
    if (/^https:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(img)) return img;
  }
  const wc = t.wikimedia_commons?.trim();
  if (wc && /^File:/i.test(wc)) return commonsUrl(wc);
  return null;
}

function normalize(el: OverpassElement): OsmGolf | null {
  const lat = el.center?.lat ?? el.lat;
  const lon = el.center?.lon ?? el.lon;
  if (lat === undefined || lon === undefined) return null;
  return fromTags(el.type, el.id, lat, lon, el.tags ?? {});
}

function fromTags(type: OverpassElement['type'], num: number, lat: number, lon: number, t: Record<string, string>): OsmGolf {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const city = [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ');
  const address = [street, city].filter(Boolean).join(', ') || null;
  return {
    id: `osm-${TYPE_PREFIX[type]}${num}`,
    name: t.name ?? t['name:fr'] ?? t['name:en'] ?? null,
    lat,
    lon,
    holes: int(t.holes ?? t['golf:holes']),
    par: int(t.par ?? t['golf:par']),
    phone: (t.phone ?? t['contact:phone'])?.split(';')[0].trim() || null,
    email: (t.email ?? t['contact:email'])?.split(';')[0].trim() || null,
    website: url(t.website ?? t['contact:website'] ?? t.url),
    address,
    openingHours: t.opening_hours?.trim() || null,
    photo: photoFromTags(t),
    description: t.description ?? null,
    osmUrl: `https://www.openstreetmap.org/${type}/${num}`,
  };
}

// Budgets réglables : sur Netlify Functions (≈ 10 s max par requête), on raccourcit les délais
const OVERPASS_BUDGET_MS = Number(process.env.OVERPASS_BUDGET_MS ?? 20000);
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS ?? 15000);
const NOMINATIM_MAX_PAGES = Number(process.env.NOMINATIM_MAX_PAGES ?? 4);

async function runOverpass(query: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  const started = Date.now();
  for (const endpoint of config.overpassUrls) {
    // Budget global de 20 s avant de basculer sur Nominatim
    if (Date.now() - started > OVERPASS_BUDGET_MS) break;
    try {
      const data = await fetchJson<{ elements: OverpassElement[] }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }).toString(),
        timeoutMs: OVERPASS_TIMEOUT_MS,
      });
      if (!Array.isArray(data.elements)) throw new UpstreamError('Réponse Overpass inattendue');
      return data.elements;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new UpstreamError(`Overpass indisponible (${(lastErr as Error)?.message ?? 'erreur'})`);
}

// ───────── Repli : Nominatim (mêmes données OSM, 40 résultats par page, 1 requête/s) ─────────

interface NominatimPlace {
  place_id: number;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  name?: string;
  extratags?: Record<string, string> | null;
  address?: Record<string, string>;
}

function fromNominatim(p: NominatimPlace): OsmGolf {
  const a = p.address ?? {};
  const tags: Record<string, string> = { ...(p.extratags ?? {}) };
  if (p.name) tags.name = p.name;
  if (a.road) tags['addr:street'] = a.road;
  if (a.house_number) tags['addr:housenumber'] = a.house_number;
  if (a.postcode) tags['addr:postcode'] = a.postcode;
  const city = a.city ?? a.town ?? a.village ?? a.municipality;
  if (city) tags['addr:city'] = city;
  return fromTags(p.osm_type, p.osm_id, Number(p.lat), Number(p.lon), tags);
}

async function nominatimArea(lat: number, lon: number, radiusKm: number): Promise<OsmGolf[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const viewbox = [lon - dLon, lat + dLat, lon + dLon, lat - dLat].map((v) => v.toFixed(3)).join(',');
  const out: NominatimPlace[] = [];
  const exclude: number[] = [];
  for (let page = 0; page < NOMINATIM_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      q: 'golf course',
      format: 'jsonv2',
      extratags: '1',
      addressdetails: '1',
      limit: '40',
      bounded: '1',
      viewbox,
    });
    if (exclude.length) params.set('exclude_place_ids', exclude.join(','));
    const batch = await nominatimQueue(() =>
      fetchJson<NominatimPlace[]>(`https://nominatim.openstreetmap.org/search?${params}`, { timeoutMs: 15000 }),
    );
    const golfs = batch.filter((p) => p.category === 'leisure' && p.type === 'golf_course');
    out.push(...golfs);
    exclude.push(...batch.map((p) => p.place_id));
    if (batch.length < 40) break;
  }
  return out.map(fromNominatim);
}

async function nominatimLookup(type: 'node' | 'way' | 'relation', num: number): Promise<OsmGolf | null> {
  const params = new URLSearchParams({
    osm_ids: `${type[0].toUpperCase()}${num}`,
    format: 'jsonv2',
    extratags: '1',
    addressdetails: '1',
  });
  const res = await nominatimQueue(() =>
    fetchJson<NominatimPlace[]>(`https://nominatim.openstreetmap.org/lookup?${params}`, { timeoutMs: 15000 }),
  );
  return res[0] ? fromNominatim(res[0]) : null;
}

/**
 * Golfs autour d'une position. Pour la confidentialité et l'efficacité du cache, la requête
 * envoyée à Overpass porte sur le centre d'une maille d'environ 11 km (0,1°) — jamais sur la
 * position exacte — avec un rayon élargi. Le filtrage fin est fait ensuite en mémoire.
 */
const CELL = 0.1;
const CELL_MARGIN_KM = 8;

export async function golfsAround(lat: number, lon: number, radiusKm: number) {
  const cLat = round(Math.floor(lat / CELL) * CELL + CELL / 2, 2);
  const cLon = round(Math.floor(lon / CELL) * CELL + CELL / 2, 2);
  const r = Math.round((radiusKm + CELL_MARGIN_KM) * 1000);
  const query = `[out:json][timeout:25];nwr["leisure"="golf_course"](around:${r},${cLat},${cLon});out center tags qt;`;
  return cached(`osm:area:v1:${cLat}:${cLon}:${radiusKm}`, async () => {
    try {
      const els = await runOverpass(query);
      return els.map(normalize).filter((g): g is OsmGolf => g !== null);
    } catch {
      return nominatimArea(cLat, cLon, radiusKm + CELL_MARGIN_KM);
    }
  });
}

export async function golfById(id: string): Promise<OsmGolf | null> {
  const p = parseOsmId(id);
  if (!p) return null;
  const { value } = await cached(`osm:id:v1:${id}`, async () => {
    try {
      const els = await runOverpass(`[out:json][timeout:25];${p.type}(${p.num});out center tags;`);
      return els.map(normalize).find((g) => g !== null) ?? null;
    } catch {
      return nominatimLookup(p.type, p.num);
    }
  });
  return value;
}
