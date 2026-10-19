import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { assertAdminConfigured, config } from './config.ts';

const COOKIE = 'gf_admin';
const SESSION_MS = 8 * 3600_000;

function sign(payload: string) {
  return crypto.createHmac('sha256', config.adminSecret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function isAdmin(req: Request) {
  if (!assertAdminConfigured()) return false;
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

const attempts = new Map<string, { n: number; until: number }>();

export function login(req: Request, res: Response) {
  if (!assertAdminConfigured()) {
    return res.status(503).json({ error: 'admin_not_configured' });
  }
  const ip = req.ip ?? 'unknown';
  const a = attempts.get(ip);
  if (a && a.until > Date.now() && a.n >= 5) return res.status(429).json({ error: 'too_many_attempts' });

  const password = String(req.body?.password ?? '');
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  if (!safeEqual(hash(password), hash(config.adminPassword))) {
    attempts.set(ip, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return res.status(401).json({ error: 'bad_password' });
  }
  attempts.delete(ip);
  const exp = String(Date.now() + SESSION_MS);
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd,
    maxAge: SESSION_MS,
    path: '/api',
  });
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE, { path: '/api' });
  res.json({ ok: true });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
  next();
}
