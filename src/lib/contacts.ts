/**
 * Invités hors de l'app : contact choisi dans le carnet d'adresses de l'iPhone, ou nom saisi à la main.
 * Le contact n'est jamais envoyé au serveur, sauf son e-mail (pour retrouver un compte GolfUs et le prévenir dans l'app).
 */
import { internationalDigits } from './links';
import { isNative } from './platform';

export interface ExternalGuest {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** Indicatif du pays de l'appareil (fr-CH → 41), pour compléter un numéro local du carnet (079…, 06…, 612…). */
const COUNTRY_CODES: Record<string, string> = {
  CH: '41', FR: '33', ES: '34', BE: '32', LU: '352', GB: '44', IE: '353', DE: '49', AT: '43', IT: '39', PT: '351', NL: '31', US: '1', CA: '1', MA: '212', DZ: '213', TN: '216',
};

function deviceCountryCode() {
  for (const l of navigator.languages ?? [navigator.language]) {
    const region = l.split('-')[1]?.toUpperCase();
    if (region && COUNTRY_CODES[region]) return COUNTRY_CODES[region];
  }
  return null;
}

/** Numéro au format international en chiffres (pour wa.me), ou null si on ne peut pas le deviner. */
export function phoneDigits(phone: string | null) {
  if (!phone) return null;
  const intl = internationalDigits(phone);
  if (intl) return intl;
  const digits = phone.replace(/\D/g, '');
  const cc = deviceCountryCode();
  if (!cc || digits.length < 6) return null;
  return cc + digits.replace(/^0/, '');
}

/** Ce que l'utilisateur a tapé : un e-mail, un numéro ou un nom. */
export function guestFromInput(raw: string): ExternalGuest | null {
  const v = raw.trim();
  if (!v) return null;
  const key = `typed-${Date.now()}`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { key, name: v.split('@')[0], phone: null, email: v.toLowerCase() };
  if (/^\+?[\d\s().-]{6,}$/.test(v)) return { key, name: v, phone: v, email: null };
  return { key, name: v, phone: null, email: null };
}

export const canPickContact = () => isNative();

/** Ouvre le carnet d'adresses de l'iPhone et renvoie le contact choisi (mobile de préférence), ou null si annulé. */
export async function pickContact(): Promise<ExternalGuest | null> {
  const { Contacts } = await import('@capacitor-community/contacts');
  try {
    const { contact: c } = await Contacts.pickContact({ projection: { name: true, phones: true, emails: true } });
    const phones = c.phones ?? [];
    const phone = (phones.find((p) => p.type === 'mobile') ?? phones[0])?.number ?? null;
    const email = c.emails?.[0]?.address?.toLowerCase() ?? null;
    const name = c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' ') || phone || email || '—';
    return { key: `contact-${c.contactId}`, name, phone, email };
  } catch {
    // Annulé, ou accès aux contacts refusé
    return null;
  }
}

/** Lien WhatsApp vers la conversation de la personne (message prêt), ou choix du contact dans WhatsApp sans numéro. */
export function whatsappLink(phone: string | null, text: string) {
  const d = phoneDigits(phone);
  return `https://wa.me/${d ?? ''}?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone: string | null, text: string) {
  return `sms:${phone ? phone.replace(/[^\d+]/g, '') : ''}${'&'}body=${encodeURIComponent(text)}`;
}

export function mailLink(email: string, subject: string, text: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
