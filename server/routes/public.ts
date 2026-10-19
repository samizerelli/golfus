import { Router } from 'express';
import { RADII_KM } from '../../shared/types.ts';
import { isLat, isLon } from '../lib/geo.ts';
import { rateLimit } from '../lib/rateLimit.ts';
import { autocomplete, reverse } from '../services/geocode.ts';
import { geoip } from '../services/geoip.ts';
import { addReview, getGolf, getReviews, searchGolfs } from '../services/golfs.ts';
import { getRates } from '../services/rates.ts';
import { travelTimes } from '../services/travel.ts';

export const publicRouter = Router();

const LANGS = new Set(['fr', 'en', 'es']);
const lang = (v: unknown) => (typeof v === 'string' && LANGS.has(v) ? v : 'fr');

publicRouter.get('/health', (_req, res) => res.json({ ok: true }));

publicRouter.get('/golfs', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Number(req.query.radius ?? 25);
  if (!isLat(lat) || !isLon(lon)) return res.status(400).json({ error: 'invalid_coords' });
  if (!RADII_KM.includes(radius as never)) return res.status(400).json({ error: 'invalid_radius' });
  const data = await searchGolfs(lat, lon, radius);
  if (data.osmUnavailable && data.golfs.length === 0) return res.status(503).json({ error: 'osm_unavailable' });
  res.set('Cache-Control', 'no-store').json(data);
});

publicRouter.get('/golfs/:id', async (req, res) => {
  try {
    const golf = await getGolf(req.params.id);
    if (!golf) return res.status(404).json({ error: 'not_found' });
    res.json(golf);
  } catch {
    res.status(503).json({ error: 'osm_unavailable' });
  }
});

publicRouter.post('/travel', rateLimit(60, 60_000), async (req, res) => {
  const { lat, lon, destinations } = req.body ?? {};
  if (!isLat(lat) || !isLon(lon) || !Array.isArray(destinations)) return res.status(400).json({ error: 'invalid' });
  const dests = destinations
    .slice(0, 60)
    .filter((d) => typeof d?.id === 'string' && isLat(d.lat) && isLon(d.lon))
    .map((d) => ({ id: String(d.id).slice(0, 64), lat: d.lat, lon: d.lon }));
  res.set('Cache-Control', 'no-store').json(await travelTimes(lat, lon, dests));
});

publicRouter.get('/geocode/autocomplete', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 120);
  if (q.length < 2) return res.json([]);
  try {
    res.json(await autocomplete(q, lang(req.query.lang)));
  } catch {
    res.status(503).json({ error: 'geocoder_unavailable' });
  }
});

publicRouter.get('/geocode/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!isLat(lat) || !isLon(lon)) return res.status(400).json({ error: 'invalid_coords' });
  try {
    res.set('Cache-Control', 'no-store').json({ label: await reverse(lat, lon, lang(req.query.lang)) });
  } catch {
    res.json({ label: null });
  }
});

publicRouter.get('/geoip', rateLimit(10, 60_000), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(await geoip(req.ip));
  } catch {
    res.status(503).json({ error: 'geoip_unavailable' });
  }
});

publicRouter.get('/rates', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600').json(await getRates());
  } catch {
    res.status(503).json({ error: 'rates_unavailable' });
  }
});

publicRouter.get('/golfs/:id/reviews', (req, res) => res.json(getReviews(req.params.id)));

publicRouter.post('/golfs/:id/reviews', rateLimit(5, 3600_000), (req, res) => {
  const author = String(req.body?.author ?? '').trim().slice(0, 60);
  const comment = String(req.body?.comment ?? '').trim().slice(0, 2000);
  const rating = Number(req.body?.rating);
  if (!author || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'invalid' });
  const golfId = String(req.params.id);
  if (!/^(osm-[nwr]\d+|demo-[\w-]+|man-[\w-]+)$/.test(golfId)) return res.status(400).json({ error: 'invalid_id' });
  const id = addReview(golfId, author, rating, comment);
  res.status(201).json({ id });
});
