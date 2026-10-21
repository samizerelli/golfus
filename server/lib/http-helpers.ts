import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

/** Valide req.body / req.query avec un schéma zod ; répond 400 avec le détail si invalide. */
export function parse<T extends z.ZodType>(schema: T, data: unknown, res: Response): z.infer<T> | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    // Contenu refusé par le filtre de modération : code dédié, l'app affiche un message clair
    if (r.error.issues.some((i) => i.message === 'inappropriate')) {
      res.status(400).json({ error: 'inappropriate' });
      return null;
    }
    res.status(400).json({ error: 'invalid', issues: r.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })) });
    return null;
  }
  return r.data;
}

/** Limiteur par utilisateur connecté (ou IP à défaut), en mémoire. */
export function userRateLimit(key: string, max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const id = `${key}:${(req as Request & { user?: { id: string } | null }).user?.id ?? req.ip}`;
    const now = Date.now();
    const h = hits.get(id);
    if (!h || h.reset < now) hits.set(id, { n: 1, reset: now + windowMs });
    else if (++h.n > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ error: 'rate_limited' });
    }
    next();
  };
}
