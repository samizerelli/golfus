/**
 * Connexion de l'app iOS (Capacitor) par jeton.
 *
 * Dans l'app, la page est servie depuis capacitor://localhost et l'API depuis https://golfus.ch : iOS bloque
 * les cookies intersites, la session par cookie du site ne peut donc pas servir. L'app reçoit à la connexion
 * un jeton signé (HS256, clé dérivée de AUTH_SECRET), conservé dans le trousseau iOS (Keychain), et l'envoie
 * dans l'en-tête « Authorization: Bearer … ». Le site web garde sa session par cookie.
 *
 * Le jeton porte la version de session du compte : changer de mot de passe ou « se déconnecter partout »
 * l'invalide, comme les sessions du site.
 */
import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { rateLimit } from '../lib/rateLimit.ts';
import { clean } from '../lib/moderation.ts';
import { parse } from '../lib/http-helpers.ts';
import { exchangeAppleCode, verifyAppleIdentity } from './apple.ts';
import { checkCredentials } from './config.ts';

const AUDIENCE = 'golfus-ios';
const TTL_DAYS = 30;

function key() {
  if (!config.authSecret) throw new Error('AUTH_SECRET manquant');
  // Clé distincte de celle des cookies Auth.js
  return createHash('sha256').update(`golfus-mobile:${config.authSecret}`).digest();
}

export interface MobileClaims {
  uid: string;
  sv: number;
  method: string;
  authAt: number;
}

export async function signMobileToken(c: MobileClaims) {
  return new SignJWT({ sv: c.sv, method: c.method, authAt: c.authAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(c.uid)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(key());
}

/** Jeton valide et non révoqué → infos de session ; sinon null. */
export async function verifyMobileToken(token: string): Promise<MobileClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE, algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const row = await db.get<{ session_version: number }>('SELECT session_version FROM users WHERE id = ?', payload.sub);
    if (!row || row.session_version !== payload.sv) return null;
    return { uid: payload.sub, sv: Number(payload.sv), method: String(payload.method ?? 'credentials'), authAt: Number(payload.authAt ?? 0) };
  } catch {
    return null;
  }
}

export const bearer = (authorization: string | undefined) => (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null);

export const mobileRouter = Router();

/** Connexion e-mail + mot de passe depuis l'app : renvoie un jeton (aucun cookie). */
mobileRouter.post('/mobile/login', rateLimit(20, 15 * 60_000), async (req, res) => {
  const u = await checkCredentials(req.body?.email, req.body?.password);
  if (!u) return res.status(401).json({ error: 'invalid_credentials' });
  await issue(res, u.id, 'credentials');
});

async function issue(res: import('express').Response, uid: string, method: string) {
  const row = await db.get<{ session_version: number }>('UPDATE users SET last_login_at = now() WHERE id = ? RETURNING session_version', uid);
  const token = await signMobileToken({ uid, sv: row?.session_version ?? 0, method, authAt: Date.now() });
  res.set('Cache-Control', 'no-store').json({ token, expiresInDays: TTL_DAYS });
}

const AppleBody = z.object({
  identityToken: z.string().min(20).max(5000),
  nonce: z.string().min(16).max(128),
  authorizationCode: z.string().max(500).optional(),
  // Apple ne transmet le prénom qu'à la toute première connexion
  givenName: z.string().trim().max(60).refine(clean, { message: 'inappropriate' }).optional(),
  lang: z.enum(['fr', 'en', 'es']).default('fr'),
});

/**
 * « Se connecter avec Apple » : compte retrouvé par l'identifiant Apple, sinon par l'e-mail vérifié par Apple,
 * sinon créé (les conditions sont acceptées sur l'écran de connexion, comme pour l'inscription).
 */
mobileRouter.post('/mobile/apple', rateLimit(20, 15 * 60_000), async (req, res) => {
  const b = parse(AppleBody, req.body, res);
  if (!b) return;
  const id = await verifyAppleIdentity(b.identityToken, b.nonce);
  if (!id) return res.status(401).json({ error: 'invalid_apple_token' });

  let uid = (await db.get<{ user_id: string }>("SELECT user_id FROM accounts WHERE provider = 'apple' AND provider_account_id = ?", id.sub))?.user_id;
  if (!uid && id.email && id.emailVerified) uid = (await db.get<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', id.email))?.id;
  if (!uid) {
    uid = randomUUID();
    await db.run(
      'INSERT INTO users (id, email, email_verified, name, lang, terms_accepted_at) VALUES (?, ?, ?, ?, ?, now())',
      uid,
      id.email,
      id.emailVerified ? new Date().toISOString() : null,
      b.givenName || null,
      b.lang,
    );
  }
  const refresh = b.authorizationCode ? await exchangeAppleCode(b.authorizationCode) : null;
  await db.run(
    `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token) VALUES (?, 'oidc', 'apple', ?, ?)
     ON CONFLICT (provider, provider_account_id) DO UPDATE SET refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token)`,
    uid,
    id.sub,
    refresh,
  );
  await issue(res, uid, 'apple');
});

// ───────── Export des données depuis l'app ─────────

const EXPORT_AUDIENCE = 'golfus-export';

/** Lien d'export valable 5 minutes : l'app l'ouvre dans Safari intégré, qui n'a pas le jeton de l'app. */
export async function signExportToken(uid: string, sv: number) {
  return new SignJWT({ sv }).setProtectedHeader({ alg: 'HS256' }).setSubject(uid).setAudience(EXPORT_AUDIENCE).setIssuedAt().setExpirationTime('5m').sign(key());
}

export async function verifyExportToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience: EXPORT_AUDIENCE, algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const row = await db.get<{ session_version: number }>('SELECT session_version FROM users WHERE id = ?', payload.sub);
    return row && row.session_version === payload.sv ? payload.sub : null;
  } catch {
    return null;
  }
}
