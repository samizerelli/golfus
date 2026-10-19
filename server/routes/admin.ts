import crypto from 'node:crypto';
import { Router } from 'express';
import { hashPassword } from '../auth/password.ts';
import { db } from '../db/index.ts';
import { assertAdminConfigured } from '../config.ts';
import { isAdmin, login, logout, requireAdmin } from '../auth.ts';
import { isValidOpeningHours, sanitizeGolf } from '../lib/validate.ts';
import { deleteGolf, deleteReview, getEditable, getReviews, listCurated, saveGolf } from '../services/golfs.ts';

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

adminRouter.post('/validate-hours', (req, res) => {
  res.json({ valid: isValidOpeningHours(String(req.body?.value ?? '')) });
});
