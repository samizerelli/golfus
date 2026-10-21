import crypto from 'node:crypto';
import { Router } from 'express';
import { hashPassword } from '../auth/password.ts';
import { db } from '../db/index.ts';
import { assertAdminConfigured } from '../config.ts';
import { isAdmin, login, logout, requireAdmin } from '../auth.ts';
import { isValidOpeningHours, sanitizeGolf } from '../lib/validate.ts';
import { deleteGolf, deleteReview, getEditable, getGolf, getReviews, listCurated, saveGolf } from '../services/golfs.ts';
import { extractFromSite } from '../services/siteExtract.ts';

export const adminRouter = Router();

adminRouter.get('/session', (req, res) => res.json({ configured: assertAdminConfigured(), admin: isAdmin(req) }));
adminRouter.post('/login', login);
adminRouter.post('/logout', logout);

adminRouter.use(requireAdmin);

adminRouter.get('/golfs', async (_req, res) => res.json(await listCurated()));

adminRouter.get('/golfs/:id', async (req, res) => {
  const data = await getEditable(req.params.id);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ...data, reviews: await getReviews(req.params.id) });
});

adminRouter.post('/golfs', async (req, res) => {
  const id = `man-${crypto.randomBytes(5).toString('hex')}`;
  const { golf, error } = sanitizeGolf(id, req.body ?? {});
  if (error) return res.status(400).json({ error });
  await saveGolf(golf!);
  res.status(201).json({ id });
});

adminRouter.put('/golfs/:id', async (req, res) => {
  if (!/^(osm-[nwr]\d+|demo-[\w-]+|man-[\w-]+)$/.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
  const { golf, error } = sanitizeGolf(req.params.id, req.body ?? {});
  if (error) return res.status(400).json({ error });
  await saveGolf(golf!);
  res.json({ ok: true });
});

adminRouter.delete('/golfs/:id', async (req, res) => {
  await deleteGolf(req.params.id);
  res.json({ ok: true });
});

adminRouter.delete('/reviews/:id', async (req, res) => {
  await deleteReview(Number(req.params.id));
  res.json({ ok: true });
});

// ───── Signalements (modération des contenus des utilisateurs) ─────
adminRouter.get('/reports', async (req, res) => {
  const status = req.query.status === 'all' ? null : 'open';
  const rows = await db.all<{ id: number; kind: string; target_id: string; reason: string; details: string | null; status: string; created_at: string; reporters: number }>(
    `SELECT MIN(id) AS id, kind, target_id, string_agg(DISTINCT reason, ', ') AS reason, string_agg(details, ' · ') AS details,
            MIN(status) AS status, MIN(created_at) AS created_at, COUNT(DISTINCT reporter_key)::int AS reporters
     FROM reports ${status ? "WHERE status = 'open'" : ''} GROUP BY kind, target_id ORDER BY MIN(created_at) LIMIT 200`,
  );
  // Contenu signalé, pour décider sans quitter la page
  const out = [];
  for (const r of rows) {
    const target =
      r.kind === 'review'
        ? await db.get('SELECT id, golf_id AS "golfId", author, rating, comment, hidden_at AS "hiddenAt" FROM reviews WHERE id = ?', Number(r.target_id))
        : r.kind === 'user'
          ? await db.get('SELECT id, name, email, image FROM users WHERE id = ?', r.target_id)
          : await db.get('SELECT o.id, o.golf_name AS "golfName", o.date, o.message, u.name AS "organizer", u.id AS "organizerId" FROM outings o JOIN users u ON u.id = o.organizer_id WHERE o.id = ?', r.target_id);
    out.push({ ...r, target: target ?? null });
  }
  res.json(out);
});

/** Clôture des signalements d'une cible. dismiss : signalement infondé (un avis masqué redevient visible). */
adminRouter.post('/reports/close', async (req, res) => {
  const kind = String(req.body?.kind ?? '');
  const targetId = String(req.body?.targetId ?? '');
  const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
  await db.run("UPDATE reports SET status = ?, resolved_at = now() WHERE kind = ? AND target_id = ? AND status = 'open'", status, kind, targetId);
  if (kind === 'review' && status === 'dismissed') await db.run('UPDATE reviews SET hidden_at = NULL WHERE id = ?', Number(targetId));
  res.json({ ok: true });
});

// ───── Messages du formulaire « Aide et contact » ─────
adminRouter.get('/messages', async (req, res) => {
  res.json(
    await db.all(
      `SELECT id, email, topic, message, created_at AS "createdAt", handled_at AS "handledAt" FROM contact_messages
       ${req.query.all ? '' : 'WHERE handled_at IS NULL'} ORDER BY created_at DESC LIMIT 200`,
    ),
  );
});

adminRouter.post('/messages/:id/handled', async (req, res) => {
  await db.run('UPDATE contact_messages SET handled_at = now() WHERE id = ?', Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.delete('/outings/:id', async (req, res) => {
  await db.run('DELETE FROM outings WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// ───── Utilisateurs ─────
adminRouter.get('/users', async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  res.json(
    await db.all(
      `SELECT id, email, name, role, created_at AS "createdAt", last_login_at AS "lastLoginAt", (password_hash IS NOT NULL) AS "hasPassword"
       FROM users ${q ? 'WHERE lower(email) LIKE ? OR lower(name) LIKE ?' : ''} ORDER BY created_at DESC LIMIT 200`,
      ...(q ? [`%${q}%`, `%${q}%`] : []),
    ),
  );
});

/** Mot de passe provisoire (affiché une seule fois à l'administrateur) : utile quand l'e-mail n'est pas configuré. */
adminRouter.post('/users/:id/reset-password', async (req, res) => {
  const temp = crypto.randomBytes(9).toString('base64url') + '7';
  const r = await db.run('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', await hashPassword(temp), req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ temporaryPassword: temp });
});

adminRouter.post('/users/:id/role', async (req, res) => {
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  await db.run('UPDATE users SET role = ? WHERE id = ?', role, req.params.id);
  res.json({ ok: true });
});

adminRouter.delete('/users/:id', async (req, res) => {
  await db.run('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// ───── Données des sites officiels (proposées, jamais publiées sans validation) ─────

/** Analyse le site officiel d'un golf et enregistre les propositions. */
adminRouter.post('/extract', async (req, res) => {
  const golfId = String(req.body?.golfId ?? '');
  const golf = await getGolf(golfId).catch(() => null);
  if (!golf) return res.status(404).json({ error: 'not_found' });
  let site = typeof req.body?.url === 'string' && req.body.url ? String(req.body.url) : golf.website;
  if (!site) return res.status(400).json({ error: 'no_website' });
  try {
    site = new URL(site).href;
  } catch {
    return res.status(400).json({ error: 'bad_url' });
  }
  const data = await extractFromSite(site, Number(process.env.EXTRACT_BUDGET_MS ?? 9000));
  const row = await db.get<{ id: number }>(
    'INSERT INTO site_extractions (golf_id, golf_name, site, data, price_count, suggested_count) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    golfId,
    golf.name,
    site,
    JSON.stringify(data),
    data.prices.length,
    data.prices.filter((p) => p.suggested).length,
  );
  res.json({ id: row!.id, golfId, golfName: golf.name, ...data });
});

/** Dernière proposition pour un golf */
adminRouter.get('/extractions/latest/:golfId', async (req, res) => {
  const r = await db.get<{ id: number; data: string; status: string; created_at: string }>(
    'SELECT id, data, status, created_at FROM site_extractions WHERE golf_id = ? ORDER BY created_at DESC LIMIT 1',
    String(req.params.golfId),
  );
  res.json(r ? { id: r.id, status: r.status, createdAt: r.created_at, ...JSON.parse(r.data) } : null);
});

/** File de vérification */
adminRouter.get('/extractions', async (req, res) => {
  const status = ['pending', 'applied', 'dismissed'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
  res.json(
    await db.all(
      `SELECT id, golf_id AS "golfId", golf_name AS "golfName", site, price_count AS "priceCount", suggested_count AS "suggestedCount", status, created_at AS "createdAt"
       FROM site_extractions WHERE status = ? ORDER BY created_at DESC LIMIT 200`,
      status,
    ),
  );
});

adminRouter.post('/extractions/:id/status', async (req, res) => {
  const status = req.body?.status === 'applied' ? 'applied' : 'dismissed';
  await db.run('UPDATE site_extractions SET status = ? WHERE id = ?', status, Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post('/validate-hours', (req, res) => {
  res.json({ valid: isValidOpeningHours(String(req.body?.value ?? '')) });
});
