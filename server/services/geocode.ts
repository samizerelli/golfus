import type { PlaceSuggestion } from '../../shared/types.ts';
import { cached } from '../lib/cache.ts';
import { fetchJson } from '../lib/http.ts';
import { round } from '../lib/geo.ts';
import { nominatimQueue } from '../lib/throttle.ts';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

const PHOTON_LANGS = new Set(['fr', 'en', 'de', 'it']);

/**
 * Autocomplétion via Photon (Komoot), conçu pour la recherche à la frappe.
 * (Les conditions d'usage de Nominatim interdisent l'autocomplétion.)
 */
export async function autocomplete(q: string, lang: string): Promise<PlaceSuggestion[]> {
  const l = PHOTON_LANGS.has(lang) ? lang : 'default';
  const key = `photon:${l}:${q.toLowerCase()}`;
  const { value } = await cached(key, async () => {
    const params = new URLSearchParams({ q, limit: '7' });
    if (l !== 'default') params.set('lang', l);
    const data = await fetchJson<{ features: PhotonFeature[] }>(`https://photon.komoot.io/api/?${params}`, {
      timeoutMs: 8000,
    });
    const seen = new Set<string>();
    return data.features
      .map((f): PlaceSuggestion => {
        const p = f.properties;
        const street = [p.housenumber, p.street].filter(Boolean).join(' ');
        const label = p.name ?? (street || p.city || p.county || '');
        const sub = [p.name ? street : null, p.city, p.state, p.country].filter((x) => x && x !== label);
        return {
          label,
          sublabel: [...new Set(sub)].join(', '),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          kind: p.osm_value ?? p.type ?? 'place',
        };
      })
      .filter((s) => {
        const k = `${s.label}|${s.sublabel}`;
        if (!s.label || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  });
  return value;
}

/** Nom de lieu approximatif (ville) pour une position — coordonnées arrondies à ~1 km. */
export async function reverse(lat: number, lon: number, lang: string): Promise<string | null> {
  const rLat = round(lat, 2);
  const rLon = round(lon, 2);
  const { value } = await cached(`nominatim:rev:${lang}:${rLat}:${rLon}`, async () => {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(rLat),
      lon: String(rLon),
      zoom: '12',
      'accept-language': lang,
    });
    const data = await nominatimQueue(() =>
      fetchJson<{ address?: Record<string, string>; name?: string }>(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        { timeoutMs: 8000 },
      ),
    );
    const a = data.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? data.name ?? null;
    return [city, a.country].filter(Boolean).join(', ') || null;
  });
  return value;
}
