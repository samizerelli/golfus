/**
 * « Se connecter avec Apple » dans l'app iOS.
 *
 * L'app reçoit d'iOS un jeton d'identité signé par Apple ; le serveur le vérifie avec les clés publiques d'Apple
 * (émetteur, destinataire = identifiant de l'app, expiration, nonce) puis ouvre ou crée le compte GolfUs.
 * Aucune clé secrète n'est nécessaire pour cette vérification.
 *
 * Suppression du compte : Apple demande de révoquer l'accès. Possible quand une clé « Sign in with Apple »
 * est configurée (APPLE_SIWA_KEY_ID, APPLE_SIWA_PRIVATE_KEY) : le code d'autorisation reçu à la connexion
 * est échangé contre un jeton de rafraîchissement, révoqué à la suppression.
 */
import crypto from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { config } from '../config.ts';
import { db } from '../db/index.ts';

const ISSUER = 'https://appleid.apple.com';
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/auth/keys`));

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export interface AppleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

/** Jeton d'identité Apple valide pour l'app et pour ce nonce → identité ; sinon null. */
export async function verifyAppleIdentity(identityToken: string, rawNonce: string): Promise<AppleIdentity | null> {
  try {
    const { payload } = await jwtVerify(identityToken, jwks, { issuer: ISSUER, audience: config.apns.bundleId, algorithms: ['RS256'] });
    if (typeof payload.sub !== 'string') return null;
    // L'app envoie à Apple l'empreinte du nonce et au serveur le nonce lui-même : un jeton intercepté seul ne suffit pas
    if (payload.nonce !== sha256(rawNonce)) return null;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    return { sub: payload.sub, email, emailVerified: payload.email_verified === true || payload.email_verified === 'true' };
  } catch {
    return null;
  }
}

const siwaConfigured = () => !!(config.appleNative.siwaKeyId && config.appleNative.siwaPrivateKey && config.apns.teamId);

async function clientSecret() {
  const key = await importPKCS8(config.appleNative.siwaPrivateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.appleNative.siwaKeyId })
    .setIssuer(config.apns.teamId)
    .setSubject(config.apns.bundleId)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

async function appleForm(path: string, body: Record<string, string>) {
  return fetch(`${ISSUER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.apns.bundleId, client_secret: await clientSecret(), ...body }),
    signal: AbortSignal.timeout(6000),
  });
}

/** Code d'autorisation → jeton de rafraîchissement (conservé pour pouvoir révoquer l'accès). */
export async function exchangeAppleCode(code: string): Promise<string | null> {
  if (!siwaConfigured()) return null;
  try {
    const res = await appleForm('/auth/token', { grant_type: 'authorization_code', code });
    if (!res.ok) return null;
    return ((await res.json()) as { refresh_token?: string }).refresh_token ?? null;
  } catch {
    return null;
  }
}

/** À la suppression du compte : révoque l'accès « Se connecter avec Apple ». Ne lève jamais d'erreur. */
export async function revokeAppleFor(userId: string) {
  if (!siwaConfigured()) return;
  const rows = await db.all<{ refresh_token: string | null }>("SELECT refresh_token FROM accounts WHERE user_id = ? AND provider = 'apple'", userId);
  for (const r of rows) {
    if (!r.refresh_token) continue;
    await appleForm('/auth/revoke', { token: r.refresh_token, token_type_hint: 'refresh_token' }).catch(() => undefined);
  }
}
