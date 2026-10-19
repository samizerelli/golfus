import type { TravelInfo } from '../../shared/types.ts';
import { config } from '../config.ts';
import { cacheGet, cacheSet } from '../lib/cache.ts';
import { fetchJson } from '../lib/http.ts';
import { haversineKm, round } from '../lib/geo.ts';

interface Dest {
  id: string;
  lat: number;
  lon: number;
}

/** Estimation de repli : distance routière ≈ 1,3 × vol d'oiseau, à 55 km/h de moyenne */
function estimate(oLat: number, oLon: number, d: Dest): TravelInfo {
  const km = haversineKm(oLat, oLon, d.lat, d.lon) * 1.3;
  return { id: d.id, distanceKm: round(km, 1), durationMin: Math.max(1, Math.round((km / 55) * 60)), estimated: true };
}

async function osrm(oLat: number, oLon: number, dests: Dest[]) {
  const coords = [[oLon, oLat], ...dests.map((d) => [d.lon, d.lat])].map((c) => c.join(',')).join(';');
  const data = await fetchJson<{ code: string; durations: (number | null)[][]; distances: (number | null)[][] }>(
    `${config.osrmUrl}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`,
    { timeoutMs: 12000 },
  );
  if (data.code !== 'Ok') throw new Error(`OSRM: ${data.code}`);
  return dests.map((d, i) => ({ dur: data.durations[0][i + 1], dist: data.distances[0][i + 1] }));
}

async function ors(oLat: number, oLon: number, dests: Dest[]) {
  const data = await fetchJson<{ durations: (number | null)[][]; distances: (number | null)[][] }>(
    'https://api.openrouteservice.org/v2/matrix/driving-car',
    {
      method: 'POST',
      headers: { Authorization: config.orsKey!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [[oLon, oLat], ...dests.map((d) => [d.lon, d.lat])],
        sources: [0],
        metrics: ['duration', 'distance'],
      }),
      timeoutMs: 12000,
    },
  );
  return dests.map((d, i) => ({ dur: data.durations[0][i + 1], dist: data.distances[0][i + 1] }));
}

/**
 * Temps de trajet en voiture. L'origine est arrondie à ~1 km avant d'être envoyée au service
 * d'itinéraire et n'est jamais enregistrée : le cache est indexé par golf + maille arrondie.
 */
export async function travelTimes(lat: number, lon: number, dests: Dest[]): Promise<TravelInfo[]> {
  const oLat = round(lat, 2);
  const oLon = round(lon, 2);
  const out = new Map<string, TravelInfo>();
  const missing: Dest[] = [];
  for (const d of dests) {
    const hit = await cacheGet<TravelInfo>(`travel:${oLat}:${oLon}:${d.id}`);
    if (hit?.fresh) out.set(d.id, hit.value);
    else missing.push(d);
  }

  for (let i = 0; i < missing.length; i += 40) {
    const chunk = missing.slice(i, i + 40);
    try {
      const rows = config.orsKey ? await ors(oLat, oLon, chunk) : await osrm(oLat, oLon, chunk);
      for (const [j, d] of chunk.entries()) {
        const { dur, dist } = rows[j];
        const info: TravelInfo =
          dur == null || dist == null
            ? estimate(oLat, oLon, d)
            : { id: d.id, durationMin: Math.max(1, Math.round(dur / 60)), distanceKm: round(dist / 1000, 1), estimated: false };
        if (!info.estimated) await cacheSet(`travel:${oLat}:${oLon}:${d.id}`, info);
        out.set(d.id, info);
      }
    } catch {
      chunk.forEach((d) => out.set(d.id, estimate(oLat, oLon, d)));
    }
  }
  return dests.map((d) => out.get(d.id)!);
}
