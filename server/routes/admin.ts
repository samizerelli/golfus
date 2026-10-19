import crypto from 'node:crypto';
import { Router } from 'express';
import { assertAdminConfigured } from '../config.ts';
import { isAdmin, login, logout, requireAdmin } from '../auth.ts';
import { isValidOpeningHours, sanitizeGolf } from '../lib/validate.ts';
import { deleteGolf, deleteReview, getEditable, getReviews, listCurated, saveGolf } from '../services/golfs.ts';

export const adminRouter = Router();

adminRouter.get('/session', (req, res) => res.json({ configured: assertAdminConfigured(), admin: isAdmin(req) }));
adminRouter.post('/login', login);
adminRouter.post('/logout', logout);

adminRouter.use(requireAdmin);

adminRouter.get('/golfs', (_req, res) => res.json(listCurated()));

adminRouter.get('/golfs/:id', async (req, res) => {
  const data = await getEditable(req.params.id);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ ...data, reviews: getReviews(req.params.id) });
});

adminRouter.post('/golfs', (req, res) => {
  const id = `man-${crypto.randomBytes(5).toString('hex')}`;
  const { golf, error } = sanitizeGolf(id, req.body ?? {});
  if (error) return res.status(400).json({ error });
  saveGolf(golf!);
  res.status(201).json({ id });
});

adminRouter.put('/golfs/:id', (req, res) => {
  if (!/^(osm-[nwr]\d+|demo-[\w-]+|man-[\w-]+)$/.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
  const { golf, error } = sanitizeGolf(req.params.id, req.body ?? {});
  if (error) return res.status(400).json({ error });
  saveGolf(golf!);
  res.json({ ok: true });
});

adminRouter.delete('/golfs/:id', (req, res) => {
  deleteGolf(req.params.id);
  res.json({ ok: true });
});

adminRouter.delete('/reviews/:id', (req, res) => {
  deleteReview(Number(req.params.id));
  res.json({ ok: true });
});

adminRouter.post('/validate-hours', (req, res) => {
  res.json({ valid: isValidOpeningHours(String(req.body?.value ?? '')) });
});
