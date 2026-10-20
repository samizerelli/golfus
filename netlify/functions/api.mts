/**
 * API GolfUs sur Netlify Functions (format v2, ESM natif).
 *
 * L'application Express tourne à l'intérieur de la fonction sur un port local ; chaque requête Netlify
 * lui est relayée telle quelle (méthode, en-têtes, corps, cookies), puis la réponse est renvoyée.
 * Base de données : Netlify Database (Postgres managé, NETLIFY_DB_URL fournie par Netlify).
 * Chaque requête dispose d'environ 10 s : les délais OpenStreetMap sont raccourcis.
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV ??= 'production';
process.env.TRUST_FORWARDED_HOST = '1';
process.env.OVERPASS_BUDGET_MS ??= '4500';
process.env.OVERPASS_TIMEOUT_MS ??= '4000';
process.env.NOMINATIM_MAX_PAGES ??= '1';
process.env.EXTRACT_BUDGET_MS ??= '7000';

let base: Promise<string> | null = null;

async function start() {
  const { createApp } = await import('../../server/app.ts');
  const { db } = await import('../../server/db/index.ts');
  // Première mise en route de la base : insertion des golfs de démonstration
  const r = await db.get<{ n: number }>('SELECT COUNT(*)::int AS n FROM golfs WHERE is_demo = 1');
  if (!r?.n) await (await import('../../server/db/seed.ts')).seedDemo();
  // Fiches de golf vérifiées : importées une fois par version du fichier de données
  await (await import('../../server/db/curated.ts')).importCurated();
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export default async (req: Request, context: { ip?: string }) => {
  base ??= start().catch((e) => {
    base = null;
    throw e;
  });
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  if (context.ip) headers.set('x-forwarded-for', context.ip);
  const res = await fetch(`${await base}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
};

export const config = { path: '/api/*' };
