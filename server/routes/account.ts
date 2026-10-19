import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authProviders } from '../auth/config.ts';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/password.ts';
import { requireUser } from '../auth/session.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { decodeImageDataUrl } from '../lib/files.ts';
import { parse, userRateLimit } from '../lib/http-helpers.ts';

const LANGS = ['fr', 'en', 'es'] as const;
export const accountRouter = Router();

accountRouter.get('/auth-providers', (_req, res) => res.json(authProviders()));

/** Inscription e-mail + mot de passe (la connexion elle-même passe par Auth.js). */
accountRouter.post('/account/register', userRateLimit('register', 10, 3600_000), async (req, res) => {
  const b = parse(
    z.object({
      email: z.string().trim().toLowerCase().email().max(200),
      password: z.string().max(200),
      name: z.string().trim().min(1).max(60),
      lang: z.enum(LANGS).default('fr'),
      terms: z.literal(true),
    }),
    req.body,
    res,
  );
  if (!b) return;
  const problem = passwordProblem(b.password);
  if (problem) return res.status(400).json({ error: problem });
  const exists = await db.get('SELECT 1 FROM users WHERE email = ?', b.email);
  if (exists) return res.status(409).json({ error: 'email_taken' });
  await db.run(
    'INSERT INTO users (id, email, name, password_hash, lang, terms_accepted_at) VALUES (?, ?, ?, ?, ?, now())',
    crypto.randomUUID(),
    b.email,
    b.name,
    await hashPassword(b.password),
    b.lang,
  );
  res.status(201).json({ ok: true });
});

interface MeRow {
  id: string;
  email: string;
  email_verified: string | null;
  name: string | null;
  image: string | null;
  handicap_index: number | null;
  lang: string;
  role: string;
  password_hash: string | null;
  created_at: string;
}

export async function meOf(id: string) {
  const u = await db.get<MeRow>('SELECT * FROM users WHERE id = ?', id);
  if (!u) return null;
  const providers = (await db.all<{ provider: string }>('SELECT provider FROM accounts WHERE user_id = ?', id)).map((r) => r.provider);
  return {
    id: u.id,
    email: u.email,
    emailVerified: !!u.email_verified,
    name: u.name,
    image: u.image,
    handicapIndex: u.handicap_index,
    lang: u.lang,
    role: u.role,
    hasPassword: !!u.password_hash,
    providers,
    createdAt: u.created_at,
  };
}

accountRouter.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ user: req.user ? await meOf(req.user.id) : null });
});

accountRouter.patch('/me', requireUser, async (req, res) => {
  const b = parse(
    z.object({
      name: z.string().trim().min(1).max(60).optional(),
      handicapIndex: z.number().min(-10).max(54).nullable().optional(),
      lang: z.enum(LANGS).optional(),
    }),
    req.body,
    res,
  );
  if (!b) return;
  if (b.name !== undefined) await db.run('UPDATE users SET name = ? WHERE id = ?', b.name, req.user!.id);
  if (b.handicapIndex !== undefined) await db.run('UPDATE users SET handicap_index = ? WHERE id = ?', b.handicapIndex, req.user!.id);
  if (b.lang !== undefined) await db.run('UPDATE users SET lang = ? WHERE id = ?', b.lang, req.user!.id);
  res.json({ user: await meOf(req.user!.id) });
});

/** Photo de profil : image compressée côté navigateur (≤ 200 Ko), type vérifié sur les octets. */
accountRouter.post('/me/avatar', requireUser, userRateLimit('avatar', 20, 3600_000), async (req, res) => {
  const b = parse(z.object({ dataUrl: z.string().max(300_000).nullable() }), req.body, res);
  if (!b) return;
  if (b.dataUrl === null) {
    await db.run('UPDATE users SET image = NULL WHERE id = ?', req.user!.id);
    return res.json({ user: await meOf(req.user!.id) });
  }
  const img = decodeImageDataUrl(b.dataUrl, 200_000);
  if ('error' in img) return res.status(400).json({ error: img.error });
  await db.run('UPDATE users SET image = ? WHERE id = ?', img.dataUrl, req.user!.id);
  res.json({ user: await meOf(req.user!.id) });
});

/** Changement de mot de passe : mot de passe actuel exigé, sauf juste après une connexion par lien magique. */
accountRouter.post('/me/password', requireUser, userRateLimit('password', 10, 3600_000), async (req, res) => {
  const b = parse(z.object({ current: z.string().max(200).optional(), next: z.string().max(200) }), req.body, res);
  if (!b) return;
  const problem = passwordProblem(b.next);
  if (problem) return res.status(400).json({ error: problem });
  const u = await db.get<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id);
  const recentMagic = req.user!.method === 'email' && Date.now() - req.user!.authAt < 15 * 60_000;
  if (u?.password_hash && !recentMagic && !(await verifyPassword(b.current ?? '', u.password_hash))) return res.status(403).json({ error: 'wrong_password' });
  // Changer de mot de passe déconnecte les autres appareils
  await db.run('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', await hashPassword(b.next), req.user!.id);
  res.json({ ok: true, reauth: true });
});

/** Déconnexion de tous les appareils : invalide toutes les sessions existantes. */
accountRouter.post('/me/logout-all', requireUser, async (req, res) => {
  await db.run('UPDATE users SET session_version = session_version + 1 WHERE id = ?', req.user!.id);
  res.json({ ok: true });
});

/** Export RGPD : toutes les données du compte en JSON. */
accountRouter.get('/me/export', requireUser, userRateLimit('export', 5, 3600_000), async (req, res) => {
  const id = req.user!.id;
  const data = {
    exported_at: new Date().toISOString(),
    account: await meOf(id),
    linked_accounts: await db.all('SELECT provider, type FROM accounts WHERE user_id = ?', id),
  };
  res.setHeader('Content-Disposition', `attachment; filename="golfus-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

/** Suppression définitive du compte. */
accountRouter.delete('/me', requireUser, async (req, res) => {
  const b = parse(z.object({ confirmEmail: z.string().trim().toLowerCase() }), req.body, res);
  if (!b) return;
  if (b.confirmEmail !== req.user!.email.toLowerCase()) return res.status(400).json({ error: 'confirm_mismatch' });
  await db.run('DELETE FROM users WHERE id = ?', req.user!.id);
  for (const name of ['authjs.session-token', '__Secure-authjs.session-token']) res.clearCookie(name, { path: '/' });
  res.json({ ok: true });
});

/** Boîte d'envoi de développement (jamais en production). */
accountRouter.get('/dev/outbox', async (_req, res) => {
  if (config.isProd) return res.status(404).json({ error: 'not_found' });
  res.json(await db.all('SELECT id, to_email AS "to", subject, url, created_at AS "createdAt" FROM dev_outbox ORDER BY id DESC LIMIT 20'));
});
