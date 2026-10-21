import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth/session.ts';
import { db } from '../db/index.ts';
import { parse, userRateLimit } from '../lib/http-helpers.ts';

/**
 * Signalements et blocages (règle App Store 1.2 : contenus publiés par les utilisateurs).
 * - Tout le monde peut signaler un avis ; un compte peut signaler un joueur ou une invitation.
 * - Un avis signalé 3 fois est masqué en attendant la décision de l'administrateur (/admin › Signalements).
 * - Bloquer un joueur retire l'amitié, empêche ses demandes et le masque dans la recherche, dans les deux sens.
 */
export const moderationRouter = Router();

/** Nombre de signalements qui masquent un avis en attendant la modération */
export const HIDE_AFTER = 3;

const Report = z.object({
  kind: z.enum(['review', 'user', 'outing']),
  targetId: z.string().trim().min(1).max(80),
  reason: z.enum(['offensive', 'harassment', 'spam', 'false_info', 'other']),
  details: z.string().trim().max(500).optional(),
});

moderationRouter.post('/reports', userRateLimit('report', 20, 3600_000), async (req, res) => {
  const b = parse(Report, req.body, res);
  if (!b) return;
  const me = req.user?.id ?? null;
  if (b.kind !== 'review' && !me) return res.status(401).json({ error: 'auth_required' });
  // Cible existante (et, pour une invitation, une partie à laquelle on est invité ou dont on a le lien)
  const exists =
    b.kind === 'review'
      ? await db.get('SELECT 1 FROM reviews WHERE id = ?', Number(b.targetId) || -1)
      : b.kind === 'user'
        ? await db.get('SELECT 1 FROM users WHERE id = ?', b.targetId)
        : await db.get('SELECT 1 FROM outings WHERE id = ?', b.targetId);
  if (!exists) return res.status(404).json({ error: 'not_found' });
  // Visiteur sans compte : clé aléatoire (aucune adresse IP n'est enregistrée)
  const key = me ?? `anon:${crypto.randomUUID()}`;
  const dup = me ? await db.get("SELECT 1 FROM reports WHERE kind = ? AND target_id = ? AND reporter_key = ? AND status = 'open'", b.kind, b.targetId, key) : null;
  if (!dup) {
    await db.run(
      'INSERT INTO reports (kind, target_id, reporter_id, reporter_key, reason, details) VALUES (?, ?, ?, ?, ?, ?)',
      b.kind,
      b.targetId,
      me,
      key,
      b.reason,
      b.details || null,
    );
  }
  if (b.kind === 'review') {
    const n = await db.get<{ n: number }>("SELECT COUNT(DISTINCT reporter_key)::int AS n FROM reports WHERE kind = 'review' AND target_id = ? AND status = 'open'", b.targetId);
    if ((n?.n ?? 0) >= HIDE_AFTER) await db.run('UPDATE reviews SET hidden_at = now() WHERE id = ? AND hidden_at IS NULL', Number(b.targetId));
  }
  res.status(201).json({ ok: true });
});

moderationRouter.get('/blocks', requireUser, async (req, res) => {
  res.json(
    await db.all(
      'SELECT u.id, u.name, u.image FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY u.name',
      req.user!.id,
    ),
  );
});

moderationRouter.post('/blocks', requireUser, userRateLimit('block', 60, 3600_000), async (req, res) => {
  const b = parse(z.object({ userId: z.string().min(1).max(80) }), req.body, res);
  if (!b) return;
  const me = req.user!.id;
  if (b.userId === me) return res.status(400).json({ error: 'self' });
  if (!(await db.get('SELECT 1 FROM users WHERE id = ?', b.userId))) return res.status(404).json({ error: 'not_found' });
  await db.run('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?) ON CONFLICT DO NOTHING', me, b.userId);
  const [x, y] = me < b.userId ? [me, b.userId] : [b.userId, me];
  await db.run('DELETE FROM friendships WHERE user_a = ? AND user_b = ?', x, y);
  // Ses invitations en attente disparaissent de mes parties, et inversement
  await db.run(
    `DELETE FROM outing_guests WHERE (user_id = ? AND outing_id IN (SELECT id FROM outings WHERE organizer_id = ?))
       OR (user_id = ? AND outing_id IN (SELECT id FROM outings WHERE organizer_id = ?))`,
    me,
    b.userId,
    b.userId,
    me,
  );
  res.status(201).json({ ok: true });
});

moderationRouter.delete('/blocks/:userId', requireUser, async (req, res) => {
  await db.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', req.user!.id, String(req.params.userId));
  res.json({ ok: true });
});

/** Vrai si l'un des deux a bloqué l'autre */
export async function isBlocked(a: string, b: string) {
  return !!(await db.get('SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a));
}
