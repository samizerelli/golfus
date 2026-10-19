import { fetchJson } from '../lib/http.ts';
import { round } from '../lib/geo.ts';

const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/i;

export interface GeoIpResult {
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
}

/**
 * Position approximative (ville) à partir de l'adresse IP, uniquement à la demande explicite du visiteur.
 * Rien n'est mis en cache ni journalisé. En local (IP privée), le service voit l'IP publique du serveur,
 * qui est alors la même que celle du visiteur.
 */
export async function geoip(ip: string | undefined): Promise<GeoIpResult> {
  const clean = ip?.replace(/^::ffff:/, '');
  const pub = clean && !PRIVATE.test(ip!) ? clean : '';
  try {
    const d = await fetchJson<{ success: boolean; latitude: number; longitude: number; city?: string; country?: string }>(
      `https://ipwho.is/${encodeURIComponent(pub)}?fields=success,city,country,latitude,longitude`,
      { timeoutMs: 6000 },
    );
    if (!d.success) throw new Error('ipwho.is: échec');
    return { lat: round(d.latitude, 2), lon: round(d.longitude, 2), city: d.city ?? null, country: d.country ?? null };
  } catch {
    const d = await fetchJson<{ latitude: string; longitude: string; city?: string; country?: string }>(
      `https://get.geojs.io/v1/ip/geo${pub ? `/${encodeURIComponent(pub)}` : ''}.json`,
      { timeoutMs: 6000 },
    );
    return { lat: round(Number(d.latitude), 2), lon: round(Number(d.longitude), 2), city: d.city ?? null, country: d.country ?? null };
  }
}
