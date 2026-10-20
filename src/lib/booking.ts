import type { BookingOffer, Currency, GolfSummary } from '../../shared/types';
import type { Criteria } from '../state/search';
import { pricePerPerson } from './criteria';

/**
 * Lien de réservation pré-rempli : ouvre la page de disponibilités du golf directement sur la date,
 * le nombre de joueurs et la demi-journée choisis, selon ce que chaque moteur de réservation accepte.
 *
 * - TeeOne (open.teeone.golf/…/disponibilidad) : ?fecha=AAAAMMJJ&numJug=N&hora=m|t
 * - Golfmanager (*.golfmanager.com/consumer/ebookings) : ?date=AAAA-MM-JJ (joueurs choisis sur la page)
 * - Río Real (reservas-golf.rioreal.com/reserva) : /reserva/fecha:AAAA-MM-JJ
 * Autres moteurs : lien inchangé.
 */
export interface BookingPrefill {
  date: string; // AAAA-MM-JJ
  timeFrom: string; // HH:MM
  timeTo: string; // HH:MM
  players: number;
}

export interface PrefilledLink {
  url: string;
  /** Ce que la page de réservation reprend réellement */
  filled: { date: boolean; players: boolean; halfDay: boolean };
}

export function prefilledBookingUrl(raw: string, p: BookingPrefill): PrefilledLink {
  const none = { url: raw, filled: { date: false, players: false, halfDay: false } };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return none;
  }

  if (u.hostname === 'open.teeone.golf' && /\/disponibilidad\/?$/.test(u.pathname)) {
    u.searchParams.set('fecha', p.date.replaceAll('-', ''));
    // Un départ accueille 4 joueurs au plus : au-delà, la page propose les départs à 4 places
    u.searchParams.set('numJug', String(Math.min(4, Math.max(1, p.players))));
    // Matin (m) ou après-midi (t) seulement si la plage choisie tient dans l'une des deux
    const halfDay = p.timeTo <= '12:00' ? 'm' : p.timeFrom >= '12:00' ? 't' : null;
    if (halfDay) u.searchParams.set('hora', halfDay);
    else u.searchParams.delete('hora');
    return { url: u.href, filled: { date: true, players: true, halfDay: !!halfDay } };
  }

  if (u.hostname.endsWith('.golfmanager.com') && u.pathname.startsWith('/consumer/ebookings')) {
    u.searchParams.set('date', p.date);
    return { url: u.href, filled: { date: true, players: false, halfDay: false } };
  }

  if (u.hostname === 'reservas-golf.rioreal.com' && u.pathname.startsWith('/reserva')) {
    u.pathname = `/reserva/fecha:${p.date}`;
    return { url: u.href, filled: { date: true, players: false, halfDay: false } };
  }

  return none;
}

// ───────────── Comparatif des canaux de réservation ─────────────


export interface BookingChoice {
  key: string;
  kind: 'club' | 'club_online' | 'platform';
  /** Nom affiché (club, plateforme) */
  name: string;
  url: string;
  amount: number | null;
  currency: Currency;
  /** date = tarif officiel calculé pour la date choisie ; observed = prix relevé pour une autre date ; none = à consulter */
  basis: 'date' | 'observed' | 'none';
  observedFor: string | null;
  note: string | null;
  /** Date, joueurs… repris par la page ouverte */
  prefilled: boolean;
  cheapest: boolean;
}

const PLATFORM_NAMES: Record<string, string> = { greenfee365: 'greenfee365' };

function platformUrl(o: BookingOffer, date: string) {
  if (o.platform === 'greenfee365' && o.ref) return `https://greenfee365.com/golf-course/${encodeURIComponent(o.ref)}?date=${date}`;
  return null;
}

/**
 * Tous les moyens de réserver ce golf, du moins cher au plus cher : tarif officiel du club pour la date choisie,
 * prix en ligne du club et prix des plateformes relevés (datés). Aucun prix n'est estimé : un canal sans prix
 * connu est listé « à consulter ».
 */
export function bookingChoices(golf: GolfSummary, c: Criteria): BookingChoice[] {
  const prefill = { date: c.date, timeFrom: c.timeFrom, timeTo: c.timeTo, players: c.players };
  const club = golf.bookingUrl ? prefilledBookingUrl(golf.bookingUrl, prefill) : golf.website ? { url: golf.website, filled: { date: false, players: false, halfDay: false } } : null;
  const list: BookingChoice[] = [];
  if (club) {
    const p = pricePerPerson(golf, c);
    list.push({
      key: 'club',
      kind: 'club',
      name: golf.name,
      url: club.url,
      amount: p?.amount ?? null,
      currency: p?.currency ?? 'EUR',
      basis: p ? 'date' : 'none',
      observedFor: null,
      note: p?.note ?? null,
      prefilled: club.filled.date,
      cheapest: false,
    });
  }
  for (const [i, o] of (golf.offers ?? []).entries()) {
    if (o.platform === 'club_online') {
      if (!club || o.amount == null) continue;
      list.push({ key: `club_online-${i}`, kind: 'club_online', name: golf.name, url: club.url, amount: o.amount, currency: o.currency, basis: 'observed', observedFor: o.observedFor, note: o.note ?? null, prefilled: club.filled.date, cheapest: false });
      continue;
    }
    const url = platformUrl(o, c.date);
    if (!url) continue;
    list.push({
      key: `${o.platform}-${i}`,
      kind: 'platform',
      name: PLATFORM_NAMES[o.platform] ?? o.platform,
      url,
      amount: o.amount,
      currency: o.currency,
      basis: o.amount == null ? 'none' : 'observed',
      observedFor: o.observedFor,
      note: o.note ?? null,
      prefilled: true,
      cheapest: false,
    });
  }
  // Tri : prix connus croissants, puis canaux à consulter
  list.sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity));
  const priced = list.filter((x) => x.amount != null);
  if (priced.length > 1) priced[0].cheapest = true;
  return list;
}

/** Offre la moins chère d'une plateforme (ou du club en ligne) si elle bat le tarif officiel du jour. */
export function cheaperElsewhere(golf: GolfSummary, c: Criteria) {
  const choices = bookingChoices(golf, c);
  const official = choices.find((x) => x.kind === 'club')?.amount ?? null;
  const best = choices.find((x) => x.kind !== 'club' && x.amount != null);
  if (!best || best.amount == null) return null;
  if (official != null && best.amount >= official) return null;
  return best;
}
