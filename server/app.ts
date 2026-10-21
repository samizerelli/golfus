import { ExpressAuth } from '@auth/express';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authConfig } from './auth/config.ts';
import { mobileRouter } from './auth/mobile.ts';
import { attachUser, csrfGuard } from './auth/session.ts';
import { config } from './config.ts';
import { accountRouter } from './routes/account.ts';
import { adminRouter } from './routes/admin.ts';
import { publicRouter } from './routes/public.ts';
import { socialRouter } from './routes/social.ts';
import { appleAppSiteAssociation, pushRouter } from './routes/push.ts';
import { moderationRouter } from './routes/moderation.ts';
import { rateLimit } from './lib/rateLimit.ts';

/** Application Express (API) : utilisée par le serveur Node (server/index.ts) et par la fonction Netlify. */
export function createApp(extra?: (app: express.Express) => void) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  // Derrière le relais Netlify : l'hôte public est transmis dans X-Forwarded-Host (utilisé par Auth.js pour ses URL)
  if (process.env.TRUST_FORWARDED_HOST === '1') {
    app.use((req, _res, next) => {
      const fwd = req.get('x-forwarded-host');
      if (fwd) req.headers.host = fwd;
      next();
    });
  }

  // En-têtes de sécurité de base
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    });
    next();
  });

  // App iOS (Capacitor) : la page vient de capacitor://localhost, l'API de golfus.ch → CORS limité à ces origines,
  // sans cookies (l'app s'authentifie par jeton)
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && config.appOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-GF-CSRF',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  });

  // Aucun journal des requêtes : les coordonnées présentes dans les URL ne sont jamais écrites.
  app.use('/api', rateLimit(240, 60_000));
  // Connexion (Auth.js) : /api/auth/signin, /callback, /session, /signout…
  app.use('/api/auth', rateLimit(40, 60_000), ExpressAuth(authConfig));
  // Universal Links de l'app iOS (fichier d'association Apple)
  app.get('/.well-known/apple-app-site-association', appleAppSiteAssociation);
  // Connexion de l'app iOS par jeton (avant la protection CSRF, qui concerne les cookies du site)
  app.use('/api', mobileRouter);
  app.use('/api', csrfGuard, attachUser);
  app.use('/api/admin', adminRouter);
  app.use('/api', accountRouter);
  app.use('/api', socialRouter);
  app.use('/api', pushRouter);
  app.use('/api', moderationRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  extra?.(app);

  app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    // Corps de requête mal formé ou trop gros : erreur du client, pas du serveur
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    console.error('[api]', err.message);
    res.status(500).json({ error: 'server_error' });
  });
  return app;
}
