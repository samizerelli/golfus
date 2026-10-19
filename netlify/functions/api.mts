/**
 * API Golf Finder sur Netlify Functions.
 *
 * Limites de cet hébergement (sans serveur permanent) :
 * - la base SQLite vit dans /tmp : elle est recréée à chaque démarrage à froid de la fonction
 *   (cache des API et modifications /admin non conservés durablement) ;
 * - chaque requête dispose d'environ 10 s : les délais OpenStreetMap sont raccourcis.
 * Pour des données permanentes (comptes, scores…), il faudra une base hébergée (voir README).
 */
import serverless from 'serverless-http';

process.env.DATABASE_PATH ??= '/tmp/golf-finder.db';
process.env.NODE_ENV ??= 'production';
process.env.OVERPASS_BUDGET_MS ??= '4500';
process.env.OVERPASS_TIMEOUT_MS ??= '4000';
process.env.NOMINATIM_MAX_PAGES ??= '1';

type Handler = ReturnType<typeof serverless>;
let ready: Promise<Handler> | null = null;

async function init(): Promise<Handler> {
  const { createApp } = await import('../../server/app.ts');
  const { db } = await import('../../server/db/index.ts');
  const n = (db.prepare('SELECT COUNT(*) AS n FROM golfs WHERE is_demo = 1').get() as { n: number }).n;
  if (!n) (await import('../../server/db/seed.ts')).seedDemo();
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
