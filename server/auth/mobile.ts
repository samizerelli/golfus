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
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { rateLimit } from '../lib/rateLimit.ts';
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
  const row = await db.get<{ session_version: number }>('UPDATE users SET last_login_at = now() WHERE id = ? RETURNING session_version', u.id);
  const token = await signMobileToken({ uid: u.id, sv: row?.session_version ?? 0, method: 'credentials', authAt: Date.now() });
  res.set('Cache-Control', 'no-store').json({ token, expiresInDays: TTL_DAYS });
});
