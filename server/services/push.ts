/**
 * Notifications push vers l'app iOS (Apple Push Notification service).
 *
 * - Authentification par jeton : clé .p8 créée dans le compte Apple Developer (APNS_KEY_ID, APPLE_TEAM_ID,
 *   APNS_PRIVATE_KEY). Sans ces variables, rien n'est envoyé et l'app garde ses notifications internes.
 * - Envoyées pour les parties (invitation, réponse, annulation, rappel la veille) et les amis (demande, acceptation).
 * - Texte dans la langue de l'appareil ; contenu limité au nécessaire (pas d'e-mail, pas de message libre).
 * - Un appareil refusé par Apple (app supprimée, jeton périmé) est retiré de la base.
 */
import crypto from 'node:crypto';
import http2 from 'node:http2';
import { config } from '../config.ts';
import { db } from '../db/index.ts';

export const PUSH_TYPES = ['outing_invite', 'outing_response', 'outing_cancelled', 'outing_reminder', 'friend_request', 'friend_accepted'] as const;
type PushType = (typeof PUSH_TYPES)[number];
type Lang = 'fr' | 'en' | 'es';

export const pushEnabled = () => !!(config.apns.keyId && config.apns.teamId && config.apns.privateKey);

// ───────── Textes ─────────

const TEXTS: Record<Lang, Record<PushType, string> & { yes: string; maybe: string; no: string }> = {
  fr: {
    outing_invite: '{from} vous invite au {golf} le {date}',
    outing_response: '{from} a répondu « {response} » pour le {golf}',
    outing_cancelled: '{from} a annulé la partie au {golf}',
    outing_reminder: 'Demain : votre partie au {golf} à {time}',
    friend_request: '{name} vous demande en ami',
    friend_accepted: '{name} a accepté votre demande d’ami',
    yes: 'Partant',
    maybe: 'Peut-être',
    no: 'Absent',
  },
  en: {
    outing_invite: '{from} invites you to {golf} on {date}',
    outing_response: '{from} answered “{response}” for {golf}',
    outing_cancelled: '{from} cancelled the round at {golf}',
    outing_reminder: 'Tomorrow: your round at {golf} at {time}',
    friend_request: '{name} wants to be your friend',
    friend_accepted: '{name} accepted your friend request',
    yes: 'I’m in',
    maybe: 'Maybe',
    no: 'Can’t make it',
  },
  es: {
    outing_invite: '{from} te invita a {golf} el {date}',
    outing_response: '{from} ha respondido «{response}» para {golf}',
    outing_cancelled: '{from} ha cancelado la partida en {golf}',
    outing_reminder: 'Mañana: tu partida en {golf} a las {time}',
    friend_request: '{name} quiere ser tu amigo',
    friend_accepted: '{name} ha aceptado tu solicitud de amistad',
    yes: 'Me apunto',
    maybe: 'Quizás',
    no: 'No viene',
  },
};

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };

export function pushText(type: PushType, lang: string, p: Record<string, unknown>) {
  const l: Lang = lang === 'en' || lang === 'es' ? lang : 'fr';
  const T = TEXTS[l];
  const date =
    typeof p.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(p.date)
      ? new Date(`${p.date}T12:00:00Z`).toLocaleDateString(LOCALES[l], { day: 'numeric', month: 'long', timeZone: 'UTC' })
      : '';
  const response = p.response === 'yes' || p.response === 'maybe' || p.response === 'no' ? T[p.response] : '';
  const vars: Record<string, string> = { from: String(p.from ?? '—'), golf: String(p.golf ?? ''), date, response, time: String(p.timeFrom ?? ''), name: String(p.name ?? '—') };
  return T[type].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

// ───────── Envoi ─────────

let jwtCache: { token: string; at: number } | null = null;

/** Jeton du fournisseur (ES256), renouvelé toutes les 50 minutes comme le demande Apple (entre 20 et 60 min). */
function providerToken() {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60_000) return jwtCache.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: config.apns.keyId })}.${b64({ iss: config.apns.teamId, iat })}`;
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: config.apns.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwtCache = { token: `${unsigned}.${sig}`, at: Date.now() };
  return jwtCache.token;
}

interface ApnsResult {
  status: number;
  reason?: string;
}

function sendOne(session: http2.ClientHttp2Session, deviceToken: string, body: string): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': config.apns.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    let data = '';
    req.setTimeout(5000, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on('response', (h) => (status = Number(h[':status'])));
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      let reason: string | undefined;
      try {
        reason = data ? (JSON.parse(data) as { reason?: string }).reason : undefined;
      } catch {
        /* réponse vide */
      }
      resolve({ status, reason });
    });
    req.on('error', () => resolve({ status: 0, reason: 'network' }));
    req.end(body);
  });
}

export interface PushReport {
  devices: number;
  sent: number;
  errors: string[];
}

/** Envoi à tous les appareils d'un utilisateur ; les jetons refusés définitivement par Apple sont oubliés. */
async function sendToUser(userId: string, bodyFor: (lang: string) => string): Promise<PushReport> {
  const devices = await db.all<{ token: string; lang: string }>('SELECT token, lang FROM push_devices WHERE user_id = ?', userId);
  const report: PushReport = { devices: devices.length, sent: 0, errors: [] };
  if (!devices.length) return report;
  const host = config.apns.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const session = http2.connect(host);
  session.on('error', () => undefined);
  try {
    await Promise.all(
      devices.map(async (d) => {
        const r = await sendOne(session, d.token, bodyFor(d.lang));
        if (r.status === 200) report.sent++;
        else report.errors.push(`APNs ${r.status} ${r.reason ?? ''}`.trim());
        if (r.status === 410 || (r.status === 400 && (r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic'))) {
          await db.run('DELETE FROM push_devices WHERE token = ?', d.token);
        }
      }),
    );
  } finally {
    session.close();
  }
  return report;
}

/** Envoie une notification à tous les appareils d'un utilisateur. Ne lève jamais d'erreur. */
export async function pushToUser(userId: string, type: string, payload: Record<string, unknown>) {
  if (!pushEnabled() || !(PUSH_TYPES as readonly string[]).includes(type)) return;
  try {
    const r = await sendToUser(userId, (lang) =>
      JSON.stringify({
        aps: { alert: { title: 'GolfUs', body: pushText(type as PushType, lang, payload) }, sound: 'default' },
        // Ouvre le bon panneau dans l'app
        panel: type.startsWith('friend_') ? 'friends' : 'outings',
      }),
    );
    for (const e of r.errors) console.warn('[push]', e);
  } catch (e) {
    console.warn('[push]', (e as Error).message);
  }
}

/** Administration : notification de test, avec le compte rendu d'Apple (vérifie la clé et l'appareil). */
export async function pushTest(userId: string): Promise<PushReport & { configured: boolean }> {
  if (!pushEnabled()) return { configured: false, devices: 0, sent: 0, errors: [] };
  try {
    const r = await sendToUser(userId, () =>
      JSON.stringify({ aps: { alert: { title: 'GolfUs', body: 'Notification de test ✅ Tout fonctionne.' }, sound: 'default' } }),
    );
    return { configured: true, ...r };
  } catch (e) {
    return { configured: true, devices: 0, sent: 0, errors: [(e as Error).message] };
  }
}
