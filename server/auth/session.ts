import { getSession } from '@auth/express';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.ts';
import { config } from '../config.ts';
import { authConfig } from './config.ts';
import { bearer, verifyMobileToken } from './mobile.ts';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  /** Mode et horodatage de la dernière connexion (credentials, email, google, apple) */
  method: string;
  authAt: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: CurrentUser | null;
  }
}

/** Charge l'utilisateur connecté (session Auth.js) dans req.user. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.user = null;
  try {
    // App iOS : jeton « Authorization: Bearer … » (pas de cookie)
    const token = bearer(req.get('authorization'));
    if (token) {
      const c = await verifyMobileToken(token);
      if (c) {
        const u = await db.get<{ id: string; email: string; name: string | null; role: 'user' | 'admin' }>('SELECT id, email, name, role FROM users WHERE id = ?', c.uid);
        if (u) req.user = { ...u, method: c.method, authAt: c.authAt };
      }
      return next();
    }
    const s = (await getSession(req, authConfig)) as { user?: { id?: string }; method?: string; authAt?: number } | null;
    if (s?.user?.id) {
      const u = await db.get<{ id: string; email: string; name: string | null; role: 'user' | 'admin' }>('SELECT id, email, name, role FROM users WHERE id = ?', s.user.id);
      if (u) req.user = { ...u, method: s.method ?? 'unknown', authAt: s.authAt ?? 0 };
    }
  } catch {
    req.user = null;
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

/**
 * Protection CSRF des routes de l'API (hors /api/auth, qui a son propre jeton) : toute requête qui modifie
 * des données doit porter l'en-tête « X-GF-CSRF: 1 ». Un site tiers ne peut pas l'ajouter sans requête CORS
 * préalable, que le serveur refuse. L'en-tête Origin, s'il est présent, doit correspondre à l'hôte.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/auth/')) return next();
  if (req.get('x-gf-csrf') !== '1') return res.status(403).json({ error: 'csrf' });
  // App iOS : authentification par jeton (aucun cookie envoyé automatiquement) depuis son origine déclarée
  const origin = req.get('origin');
  if (origin && config.appOrigins.includes(origin) && bearer(req.get('authorization'))) return next();
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      return res.status(403).json({ error: 'csrf_origin' });
    }
    const allowed = [req.get('host'), req.get('x-forwarded-host')].filter(Boolean);
    // En développement, Vite (port 5173) relaie l'API (port 8787) : les origines localhost sont acceptées
    const devLocal = process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    if (!allowed.includes(host) && !devLocal) return res.status(403).json({ error: 'csrf_origin' });
  }
  next();
}
