import path from 'node:path';

function bool(v: string | undefined, def: boolean) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'oui'].includes(v.toLowerCase());
}

const contact = process.env.CONTACT_EMAIL?.trim();

export const config = {
  // API_PORT (développement) prime sur PORT (fourni par l'hébergeur en production)
  port: Number(process.env.API_PORT || process.env.PORT || 8787),
  isProd: process.env.NODE_ENV === 'production',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  adminSecret: process.env.ADMIN_SESSION_SECRET ?? '',
  databasePath: process.env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(process.env.DATABASE_PATH || './data/golfus.db'),
  // Golfs de démonstration (tarifs fictifs) : visibles en local, masqués en ligne sauf SHOW_DEMO_DATA=true
  showDemo: bool(process.env.SHOW_DEMO_DATA, process.env.NODE_ENV !== 'production'),
  cacheTtlMs: Number(process.env.CACHE_TTL_HOURS ?? 24) * 3600_000,
  userAgent: `GolfUs/1.0 (+self-hosted${contact ? `; ${contact}` : ''})`,
  contactEmail: contact || null,
  overpassUrls: (
    process.env.OVERPASS_URLS ||
    'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.kumi.systems/api/interpreter'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  osrmUrl: (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, ''),
  orsKey: process.env.ORS_API_KEY?.trim() || null,

  // Comptes (Auth.js)
  authSecret: process.env.AUTH_SECRET || '',
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  emailServer: process.env.EMAIL_SERVER?.trim() || null,
  emailFrom: process.env.EMAIL_FROM?.trim() || 'GolfUs <no-reply@golfus.local>',
  google: process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? { id: process.env.AUTH_GOOGLE_ID, secret: process.env.AUTH_GOOGLE_SECRET } : null,
  apple: process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET ? { id: process.env.AUTH_APPLE_ID, secret: process.env.AUTH_APPLE_SECRET } : null,
};

export function assertAdminConfigured() {
  const weak = ['', 'change-moi'];
  return !weak.includes(config.adminPassword) && config.adminSecret.length >= 16;
}
