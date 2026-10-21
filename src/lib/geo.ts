import { isNative } from './platform';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export type GeoErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

/** État de la permission (« granted » | « prompt » | « denied »), ou « unknown » si l'API n'existe pas (Safari ancien) */
export async function geoPermission(): Promise<PermissionState | 'unknown'> {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    return (await navigator.permissions.query({ name: 'geolocation' as PermissionName })).state;
  } catch {
    return 'unknown';
  }
}

/**
 * App iOS : module de localisation natif (une seule demande d'autorisation, au nom de GolfUs, avec le texte
 * de Info.plist) au lieu de l'API du navigateur intégré, qui afficherait « localhost souhaite… ».
 */
async function nativeOnce(opts: PositionOptions): Promise<{ lat: number; lon: number }> {
  const { Geolocation } = await import('@capacitor/geolocation');
  let perm = await Geolocation.checkPermissions().catch(() => null);
  if (perm?.location === 'prompt' || perm?.location === 'prompt-with-rationale') perm = await Geolocation.requestPermissions({ permissions: ['location'] }).catch(() => null);
  if (perm?.location === 'denied') throw 'denied' satisfies GeoErrorCode;
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: opts.enableHighAccuracy, timeout: opts.timeout, maximumAge: opts.maximumAge });
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    throw (msg.includes('denied') ? 'denied' : msg.includes('timeout') ? 'timeout' : 'unavailable') satisfies GeoErrorCode;
  }
}

function once(opts: PositionOptions, watchdogMs: number): Promise<{ lat: number; lon: number }> {
  if (isNative()) return nativeOnce(opts);
  return new Promise((resolve, reject) => {
    // Filet de sécurité : si la demande d'autorisation est ignorée/fermée, certains navigateurs
    // n'appellent jamais les callbacks et l'option « timeout » ne s'applique pas.
    const watchdog = setTimeout(() => reject('timeout' satisfies GeoErrorCode), watchdogMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(watchdog);
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      (err) => {
        clearTimeout(watchdog);
        reject((err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable') satisfies GeoErrorCode);
      },
      opts,
    );
  });
}

/**
 * Localisation automatique à l'ouverture : haute précision, 8 s une fois l'autorisation donnée.
 * Le chien de garde (30 s) laisse le temps de répondre à la demande d'autorisation du navigateur.
 */
export async function getPositionAuto(): Promise<{ lat: number; lon: number }> {
  if (!isNative()) {
    if (!window.isSecureContext) throw 'insecure' satisfies GeoErrorCode;
    if (!('geolocation' in navigator)) throw 'unsupported' satisfies GeoErrorCode;
    if ((await geoPermission()) === 'denied') throw 'denied' satisfies GeoErrorCode;
  }
  return once({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }, 30000);
}

/** Position par défaut de la carte quand la localisation est impossible (Costa del Sol, où se trouvent les fiches vérifiées) */
export const DEFAULT_MAP_CENTER = { lat: 36.51, lon: -4.88 };

export async function getPosition(): Promise<{ lat: number; lon: number }> {
  if (!isNative()) {
    if (!window.isSecureContext) throw 'insecure' satisfies GeoErrorCode;
    if (!('geolocation' in navigator)) throw 'unsupported' satisfies GeoErrorCode;
    if ((await geoPermission()) === 'denied') throw 'denied' satisfies GeoErrorCode;
  }
  try {
    return await once({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }, 30000);
  } catch (e) {
    if (e === 'denied') throw e;
    // Le GPS haute précision peut échouer en intérieur : nouvel essai en précision normale (Wi-Fi / réseau)
    return once({ enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 }, 15000);
  }
}

export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
