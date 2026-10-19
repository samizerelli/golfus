/**
 * API GolfUs sur Netlify Functions.
 *
 * Base de données : Netlify Database (Postgres managé, variable NETLIFY_DB_URL fournie par Netlify) —
 * comptes, golfs saisis dans /admin et cache sont conservés durablement.
 * Chaque requête dispose d'environ 10 s : les délais OpenStreetMap sont raccourcis.
 */
import serverless from 'serverless-http';

process.env.NODE_ENV ??= 'production';
process.env.OVERPASS_BUDGET_MS ??= '4500';
process.env.OVERPASS_TIMEOUT_MS ??= '4000';
process.env.NOMINATIM_MAX_PAGES ??= '1';

type Handler = ReturnType<typeof serverless>;
let ready: Promise<Handler> | null = null;

async function init(): Promise<Handler> {
  const { createApp } = await import('../../server/app.ts');
  const { db } = await import('../../server/db/index.ts');
  // Première mise en route de la base : insertion des golfs de démonstration
  const r = await db.get<{ n: number }>('SELECT COUNT(*)::int AS n FROM golfs WHERE is_demo = 1');
  if (!r?.n) await (await import('../../server/db/seed.ts')).seedDemo();
  return serverless(createApp(), {
    // La redirection Netlify /api/* → /.netlify/functions/api/* : on rétablit le chemin /api attendu par Express
    request(req: { url: string }) {
      req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '/api');
    },
  });
}

export const handler = async (event: unknown, context: unknown) => {
  ready ??= init();
  return (await ready)(event as never, context as never);
};
