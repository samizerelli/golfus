import { ExpressAuth } from '@auth/express';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authConfig } from './auth/config.ts';
import { attachUser, csrfGuard } from './auth/session.ts';
import { accountRouter } from './routes/account.ts';
import { adminRouter } from './routes/admin.ts';
import { publicRouter } from './routes/public.ts';
import { rateLimit } from './lib/rateLimit.ts';

/** Application Express (API) : utilisée par le serveur Node (server/index.ts) et par la fonction Netlify. */
export function createApp(extra?: (app: express.Express) => void) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));

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

  // Aucun journal des requêtes : les coordonnées présentes dans les URL ne sont jamais écrites.
  app.use('/api', rateLimit(240, 60_000));
  // Connexion (Auth.js) : /api/auth/signin, /callback, /session, /signout…
  app.use('/api/auth', rateLimit(40, 60_000), ExpressAuth(authConfig));
  app.use('/api', csrfGuard, attachUser);
  app.use('/api/admin', adminRouter);
  app.use('/api', accountRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  extra?.(app);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api]', err.message);
    res.status(500).json({ error: 'server_error' });
  });
  return app;
}
