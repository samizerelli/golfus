import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth/session.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { parse, userRateLimit } from '../lib/http-helpers.ts';

/**
 * Appareils iOS qui reçoivent les notifications push. L'app enregistre son jeton APNs après que l'utilisateur
 * a accepté les notifications, et le retire à la déconnexion. Un jeton n'appartient qu'à un seul compte.
 */
export const pushRouter = Router();

const Device = z.object({
  // Jeton APNs : hexadécimal (64 caractères aujourd'hui, la longueur peut évoluer)
  token: z.string().regex(/^[0-9a-f]{64,200}$/i),
  lang: z.enum(['fr', 'en', 'es']).default('fr'),
});

pushRouter.post('/push/devices', requireUser, userRateLimit('push-register', 20, 3600_000), async (req, res) => {
  const b = parse(Device, req.body, res);
  if (!b) {
    console.warn('[push] enregistrement refusé : jeton invalide', typeof req.body?.token, String(req.body?.token ?? '').length);
    return;
  }
  console.log('[push] appareil enregistré', req.user!.id.slice(0, 8), b.token.length);
  await db.run(
    `INSERT INTO push_devices (token, user_id, platform, lang) VALUES (?, ?, 'ios', ?)
     ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, lang = excluded.lang, updated_at = now()`,
    b.token.toLowerCase(),
    req.user!.id,
    b.lang,
  );
  res.status(201).json({ ok: true });
});

// Compte rendu de l'app quand l'enregistrement échoue sur l'iPhone (visible dans les journaux du serveur)
const Diag = z.object({ stage: z.string().max(40), detail: z.string().max(300).default('') });
pushRouter.post('/push/diag', requireUser, userRateLimit('push-diag', 30, 3600_000), (req, res) => {
  const b = parse(Diag, req.body, res);
  if (!b) return;
  console.log('[push] app :', req.user!.id.slice(0, 8), b.stage, b.detail);
  res.json({ ok: true });
});

pushRouter.delete('/push/devices/:token', requireUser, async (req, res) => {
  await db.run('DELETE FROM push_devices WHERE token = ? AND user_id = ?', String(req.params.token).toLowerCase(), req.user!.id);
  res.json({ ok: true });
});

/**
 * Universal Links : les liens https://golfus.ch/invitation/… et /golf/… ouvrent l'app si elle est installée.
 * Fichier publié seulement quand APPLE_TEAM_ID est configuré.
 */
export function appleAppSiteAssociation(_req: import('express').Request, res: import('express').Response) {
  if (!config.apns.teamId) return res.status(404).json({ error: 'not_found' });
  res.type('application/json').json({
    applinks: {
      details: [
        {
          appIDs: [`${config.apns.teamId}.${config.apns.bundleId}`],
          components: [{ '/': '/invitation/*' }, { '/': '/golf/*' }],
        },
      ],
    },
  });
}
