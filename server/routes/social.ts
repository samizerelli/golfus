import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth/session.ts';
import { db } from '../db/index.ts';
import { parse, userRateLimit } from '../lib/http-helpers.ts';
import { pushToUser } from '../services/push.ts';
import { clean } from '../lib/moderation.ts';
import { isBlocked } from './moderation.ts';

/**
 * Amis, invitations à jouer (« parties ») et notifications.
 * Contrôle d'accès : un utilisateur ne lit que ses amis, ses notifications et les parties qu'il organise
 * ou auxquelles il est invité. La page publique d'une invitation n'expose que le nécessaire (via son jeton).
 */
export const socialRouter = Router();

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);
const token = () => crypto.randomBytes(12).toString('base64url');
type Resp = 'yes' | 'maybe' | 'no';

export async function notify(userId: string, type: string, payload: Record<string, unknown>) {
  await db.run('INSERT INTO notifications (user_id, type, payload) VALUES (?, ?, ?)', userId, type, JSON.stringify(payload));
  // Sur iPhone (si les notifications sont activées) : parties seulement, voir services/push.ts
  await pushToUser(userId, type, payload);
}

async function areFriends(a: string, b: string) {
  const [x, y] = pair(a, b);
  return !!(await db.get("SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ? AND status = 'accepted'", x, y));
}

// ───────── Amis ─────────

socialRouter.get('/friends', requireUser, async (req, res) => {
  const me = req.user!.id;
  const rows = await db.all<{ other: string; status: string; requested_by: string; name: string | null; image: string | null; handicap_index: number | null }>(
    `SELECT u.id AS other, f.status, f.requested_by, u.name, u.image, u.handicap_index
     FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
     WHERE f.user_a = ? OR f.user_b = ? ORDER BY u.name`,
    me,
    me,
    me,
  );
  const card = (r: (typeof rows)[number]) => ({ id: r.other, name: r.name, image: r.image, handicapIndex: r.handicap_index });
  res.json({
    friends: rows.filter((r) => r.status === 'accepted').map(card),
    incoming: rows.filter((r) => r.status === 'pending' && r.requested_by !== me).map(card),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requested_by === me).map(card),
  });
});

/** Recherche d'un joueur : e-mail exact ou début du prénom (3 caractères minimum). L'e-mail n'est jamais renvoyé. */
socialRouter.get('/users/search', requireUser, userRateLimit('user-search', 40, 60_000), async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) return res.json([]);
  res.json(
    await db.all(
      `SELECT id, name, image, handicap_index AS "handicapIndex" FROM users
       WHERE id != ? AND (lower(email) = lower(?) OR lower(name) LIKE lower(?))
         AND id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM user_blocks WHERE blocked_id = ?)
       ORDER BY name LIMIT 10`,
      req.user!.id,
      q,
      `${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`,
      req.user!.id,
      req.user!.id,
    ),
  );
});

socialRouter.post('/friends/request', requireUser, userRateLimit('friend-request', 30, 3600_000), async (req, res) => {
  const b = parse(z.object({ userId: z.string().uuid() }), req.body, res);
  if (!b) return;
  const me = req.user!.id;
  if (b.userId === me) return res.status(400).json({ error: 'self' });
  if (!(await db.get('SELECT 1 FROM users WHERE id = ?', b.userId))) return res.status(404).json({ error: 'not_found' });
  // Blocage : rien n'est créé ni notifié, la réponse ne révèle pas le blocage
  if (await isBlocked(me, b.userId)) return res.json({ status: 'pending' });
  const [a, c] = pair(me, b.userId);
  const ex = await db.get<{ status: string; requested_by: string }>('SELECT status, requested_by FROM friendships WHERE user_a = ? AND user_b = ?', a, c);
  if (ex?.status === 'accepted') return res.json({ status: 'accepted' });
  if (ex?.status === 'pending' && ex.requested_by !== me) {
    await db.run("UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?", a, c);
    await notify(b.userId, 'friend_accepted', { userId: me, name: req.user!.name });
    return res.json({ status: 'accepted' });
  }
  if (!ex) {
    await db.run("INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (?, ?, 'pending', ?)", a, c, me);
    await notify(b.userId, 'friend_request', { userId: me, name: req.user!.name });
  }
  res.json({ status: 'pending' });
});

socialRouter.post('/friends/:id/accept', requireUser, async (req, res) => {
  const me = req.user!.id;
  const [a, c] = pair(me, String(req.params.id));
  const r = await db.run("UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ? AND status = 'pending' AND requested_by != ?", a, c, me);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  await notify(String(req.params.id), 'friend_accepted', { userId: me, name: req.user!.name });
  res.json({ ok: true });
});

/** Refuser une demande, l'annuler ou retirer un ami. */
socialRouter.delete('/friends/:id', requireUser, async (req, res) => {
  const [a, c] = pair(req.user!.id, String(req.params.id));
  await db.run('DELETE FROM friendships WHERE user_a = ? AND user_b = ?', a, c);
  res.json({ ok: true });
});

// ───────── Parties (invitations à jouer) ─────────

const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const outingInput = z.object({
  golfId: z.string().regex(/^(osm-[nwr]\d+|demo-[\w-]+|man-[\w-]+)$/),
  golfName: z.string().trim().min(1).max(200),
  golfLat: z.number().min(-90).max(90).nullable(),
  golfLon: z.number().min(-180).max(180).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeFrom: zTime,
  timeTo: zTime,
  holes: z.union([z.literal(9), z.literal(18)]).nullable(),
  players: z.number().int().min(1).max(12),
  message: z.string().trim().max(1000).refine(clean, { message: 'inappropriate' }).nullable(),
  friendIds: z.array(z.string().uuid()).max(20),
});

interface OutingRow {
  id: string;
  organizer_id: string;
  organizer_name: string | null;
  golf_id: string;
  golf_name: string;
  golf_lat: number | null;
  golf_lon: number | null;
  date: string;
  time_from: string;
  time_to: string;
  holes: number | null;
  players: number;
  message: string | null;
  share_token: string;
  status: string;
  created_at: string;
}

async function outingView(o: OutingRow, viewerId: string | null) {
  const guests = await db.all<{ id: string; user_id: string | null; name: string | null; image: string | null; guest_name: string | null; response: string }>(
    `SELECT g.id, g.user_id, u.name, u.image, g.guest_name, g.response FROM outing_guests g LEFT JOIN users u ON u.id = g.user_id
     WHERE g.outing_id = ? ORDER BY g.updated_at`,
    o.id,
  );
  const isOrganizer = viewerId === o.organizer_id;
  return {
    id: o.id,
    organizer: { id: o.organizer_id, name: o.organizer_name },
    isOrganizer,
    golf: { id: o.golf_id, name: o.golf_name, lat: o.golf_lat, lon: o.golf_lon },
    date: o.date,
    timeFrom: o.time_from,
    timeTo: o.time_to,
    holes: o.holes,
    players: o.players,
    message: o.message,
    status: o.status,
    createdAt: o.created_at,
    // Le lien d'invitation n'est montré qu'à l'organisateur
    shareToken: isOrganizer ? o.share_token : undefined,
    myResponse: guests.find((g) => g.user_id && g.user_id === viewerId)?.response ?? null,
    guests: guests.map((g) => ({ id: g.id, userId: g.user_id, name: g.name ?? g.guest_name, image: g.image, external: !g.user_id, response: g.response })),
  };
}

const OUTING_SELECT = 'SELECT o.*, u.name AS organizer_name FROM outings o JOIN users u ON u.id = o.organizer_id';

socialRouter.post('/outings', requireUser, userRateLimit('outings', 30, 3600_000), async (req, res) => {
  const b = parse(outingInput, req.body, res);
  if (!b) return;
  const me = req.user!.id;
  // On ne peut inviter que ses amis
  for (const fid of b.friendIds) if (!(await areFriends(me, fid))) return res.status(403).json({ error: 'not_friend' });
  const id = crypto.randomUUID();
  await db.tx(async () => {
    await db.run(
      `INSERT INTO outings (id, organizer_id, golf_id, golf_name, golf_lat, golf_lon, date, time_from, time_to, holes, players, message, share_token)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      me,
      b.golfId,
      b.golfName,
      b.golfLat,
      b.golfLon,
      b.date,
      b.timeFrom,
      b.timeTo,
      b.holes,
      b.players,
      b.message,
      token(),
    );
    for (const fid of [...new Set(b.friendIds)]) {
      await db.run('INSERT INTO outing_guests (id, outing_id, user_id) VALUES (?, ?, ?)', crypto.randomUUID(), id, fid);
      await notify(fid, 'outing_invite', { outingId: id, golf: b.golfName, date: b.date, timeFrom: b.timeFrom, from: req.user!.name });
    }
  });
  res.status(201).json(await outingView((await db.get<OutingRow>(`${OUTING_SELECT} WHERE o.id = ?`, id))!, me));
});

/** Mes parties : organisées par moi ou auxquelles je suis invité. */
socialRouter.get('/outings', requireUser, async (req, res) => {
  const me = req.user!.id;
  const rows = await db.all<OutingRow>(
    `${OUTING_SELECT} WHERE o.organizer_id = ? OR o.id IN (SELECT outing_id FROM outing_guests WHERE user_id = ?) ORDER BY o.date DESC, o.time_from DESC LIMIT 100`,
    me,
    me,
  );
  res.json(await Promise.all(rows.map((o) => outingView(o, me))));
});

async function outingForMember(req: Request, res: Response) {
  const o = await db.get<OutingRow>(`${OUTING_SELECT} WHERE o.id = ?`, String(req.params.id));
  const me = req.user!.id;
  if (!o || (o.organizer_id !== me && !(await db.get('SELECT 1 FROM outing_guests WHERE outing_id = ? AND user_id = ?', o.id, me)))) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return o;
}

socialRouter.get('/outings/:id', requireUser, async (req, res) => {
  const o = await outingForMember(req, res);
  if (o) res.json(await outingView(o, req.user!.id));
});

const zResp = z.object({ response: z.enum(['yes', 'maybe', 'no']) });

/** Partie passée (marge d'un jour pour les fuseaux horaires) : on ne peut plus y répondre */
const isPast = (date: string) => date < new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

socialRouter.post('/outings/:id/respond', requireUser, async (req, res) => {
  const b = parse(zResp, req.body, res);
  if (!b) return;
  const o = await outingForMember(req, res);
  if (!o) return;
  if (o.organizer_id === req.user!.id) return res.status(400).json({ error: 'organizer' });
  if (o.status !== 'active' || isPast(o.date)) return res.status(409).json({ error: 'closed' });
  await db.run('UPDATE outing_guests SET response = ?, updated_at = now() WHERE outing_id = ? AND user_id = ?', b.response, o.id, req.user!.id);
  await notify(o.organizer_id, 'outing_response', { outingId: o.id, golf: o.golf_name, date: o.date, from: req.user!.name, response: b.response as Resp });
  res.json(await outingView(o, req.user!.id));
});

socialRouter.post('/outings/:id/cancel', requireUser, async (req, res) => {
  const o = await outingForMember(req, res);
  if (!o) return;
  if (o.organizer_id !== req.user!.id) return res.status(403).json({ error: 'forbidden' });
  await db.run("UPDATE outings SET status = 'cancelled', updated_at = now() WHERE id = ?", o.id);
  for (const g of await db.all<{ user_id: string }>('SELECT user_id FROM outing_guests WHERE outing_id = ? AND user_id IS NOT NULL', o.id))
    await notify(g.user_id, 'outing_cancelled', { outingId: o.id, golf: o.golf_name, date: o.date, from: req.user!.name });
  res.json({ ok: true });
});

// ───────── Invitation publique (personnes hors de l'app, via lien WhatsApp / SMS) ─────────

socialRouter.get('/invitations/:token', async (req, res) => {
  const o = await db.get<OutingRow>(`${OUTING_SELECT} WHERE o.share_token = ?`, String(req.params.token));
  if (!o) return res.status(404).json({ error: 'not_found' });
  const v = await outingView(o, req.user?.id ?? null);
  // Vue publique : prénoms et réponses seulement (+ ma réponse si je suis connecté)
  res.json({ ...v, shareToken: undefined, guests: v.guests.map((g) => ({ name: g.name, response: g.response, external: g.external })) });
});

socialRouter.post('/invitations/:token/respond', userRateLimit('guest-respond', 20, 3600_000), async (req, res) => {
  const b = parse(
    z.object({ name: z.string().trim().max(60).refine(clean, { message: 'inappropriate' }).optional(), response: z.enum(['yes', 'maybe', 'no']), guestToken: z.string().max(40).optional() }),
    req.body,
    res,
  );
  if (!b) return;
  const o = await db.get<OutingRow>(`${OUTING_SELECT} WHERE o.share_token = ?`, String(req.params.token));
  if (!o || o.status !== 'active') return res.status(404).json({ error: 'not_found' });
  if (isPast(o.date)) return res.status(409).json({ error: 'closed' });
  // Utilisateur connecté : il rejoint (ou décline) sous son compte, en un geste
  if (req.user) {
    if (req.user.id === o.organizer_id) return res.status(400).json({ error: 'organizer' });
    await db.run(
      `INSERT INTO outing_guests (id, outing_id, user_id, response) VALUES (?, ?, ?, ?)
       ON CONFLICT (outing_id, user_id) DO UPDATE SET response = excluded.response, updated_at = now()`,
      crypto.randomUUID(),
      o.id,
      req.user.id,
      b.response,
    );
    await notify(o.organizer_id, 'outing_response', { outingId: o.id, golf: o.golf_name, date: o.date, from: req.user.name, response: b.response });
    return res.json({ ok: true });
  }
  if (!b.name) return res.status(400).json({ error: 'name_required' });
  let gt = b.guestToken;
  const existing = gt ? await db.get<{ id: string }>('SELECT id FROM outing_guests WHERE outing_id = ? AND guest_token = ?', o.id, gt) : undefined;
  if (existing) await db.run('UPDATE outing_guests SET guest_name = ?, response = ?, updated_at = now() WHERE id = ?', b.name, b.response, existing.id);
  else {
    gt = token();
    await db.run('INSERT INTO outing_guests (id, outing_id, guest_name, guest_token, response) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), o.id, b.name, gt, b.response);
  }
  await notify(o.organizer_id, 'outing_response', { outingId: o.id, golf: o.golf_name, date: o.date, from: b.name, response: b.response, external: true });
  res.json({ ok: true, guestToken: gt });
});

// ───────── Notifications ─────────

socialRouter.get('/notifications', requireUser, async (req, res) => {
  const items = await db.all<{ id: number; type: string; payload: string; readAt: string | null; createdAt: string }>(
    'SELECT id, type, payload, read_at AS "readAt", created_at AS "createdAt" FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50',
    req.user!.id,
  );
  const unread = (await db.get<{ n: number }>('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user!.id))!.n;
  res.set('Cache-Control', 'no-store').json({ unread, items: items.map((i) => ({ ...i, payload: JSON.parse(i.payload) })) });
});

socialRouter.post('/notifications/read', requireUser, async (req, res) => {
  await db.run('UPDATE notifications SET read_at = now() WHERE user_id = ? AND read_at IS NULL', req.user!.id);
  res.json({ ok: true });
});
