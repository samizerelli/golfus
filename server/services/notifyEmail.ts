/**
 * E-mails de notification : demande d'ami et invitation à une partie.
 * Ils complètent la cloche de l'app et les notifications iPhone, pour prévenir aussi ceux qui n'ont pas ouvert l'app.
 * Sans serveur d'envoi (EMAIL_SERVER), rien n'est envoyé ; une erreur d'envoi ne bloque jamais l'action.
 */
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { mailEnabled, sendMail } from '../auth/mailer.ts';
import { pushText } from './push.ts';

const EMAIL_TYPES = ['friend_request', 'outing_invite'] as const;
type EmailType = (typeof EMAIL_TYPES)[number];
type Lang = 'fr' | 'en' | 'es';

const T: Record<Lang, Record<EmailType, { subject: string; body: string }> & { button: string; footer: string }> = {
  fr: {
    friend_request: { subject: '{name} vous demande en ami sur GolfUs', body: 'Acceptez sa demande dans GolfUs (menu Amis) pour organiser vos parties ensemble.' },
    outing_invite: { subject: '{from} vous invite à jouer au golf', body: 'Répondez Partant, Peut-être ou Non dans GolfUs (menu Mes parties).' },
    button: 'Ouvrir GolfUs',
    footer: 'Vous recevez cet e-mail car un ami vous a contacté sur GolfUs.',
  },
  en: {
    friend_request: { subject: '{name} wants to be your friend on GolfUs', body: 'Accept the request in GolfUs (Friends menu) to organise your rounds together.' },
    outing_invite: { subject: '{from} invites you to play golf', body: 'Answer Yes, Maybe or No in GolfUs (My rounds menu).' },
    button: 'Open GolfUs',
    footer: 'You are receiving this email because a friend contacted you on GolfUs.',
  },
  es: {
    friend_request: { subject: '{name} quiere ser tu amigo en GolfUs', body: 'Acepta la solicitud en GolfUs (menú Amigos) para organizar vuestras partidas.' },
    outing_invite: { subject: '{from} te invita a jugar al golf', body: 'Responde Me apunto, Quizás o No en GolfUs (menú Mis partidas).' },
    button: 'Abrir GolfUs',
    footer: 'Recibes este correo porque un amigo te ha contactado en GolfUs.',
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function notificationEmail(type: EmailType, lang: string, p: Record<string, unknown>) {
  const l: Lang = lang === 'en' || lang === 'es' ? lang : 'fr';
  const t = T[l];
  const subject = t[type].subject.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? '—'));
  // Phrase détaillée (golf, date) : la même que la notification iPhone
  const line = pushText(type, l, p);
  const url = config.appUrl;
  return {
    subject,
    text: `${line}\n\n${t[type].body}\n${url}\n\n${t.footer}`,
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f1a24">
<h1 style="font-size:20px">⛳ GolfUs</h1><p style="font-size:16px;font-weight:600">${esc(line)}</p><p>${esc(t[type].body)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#1f5d4a;color:#fff;padding:12px 20px;border-radius:14px;text-decoration:none;font-weight:600">${esc(t.button)}</a></p>
<p style="color:#5b6670;font-size:13px">${esc(t.footer)}</p></div>`,
  };
}

/** Envoie l'e-mail correspondant à une notification, si ce type en prévoit un. Ne lève jamais d'erreur. */
export async function emailToUser(userId: string, type: string, payload: Record<string, unknown>) {
  if (!mailEnabled() || !(EMAIL_TYPES as readonly string[]).includes(type)) return;
  try {
    const u = await db.get<{ email: string | null; lang: string }>('SELECT email, lang FROM users WHERE id = ?', userId);
    if (!u?.email) return;
    const m = notificationEmail(type as EmailType, u.lang, payload);
    await sendMail(u.email, m.subject, m.text, m.html);
  } catch (e) {
    console.warn('[mail]', type, (e as Error).message);
  }
}
