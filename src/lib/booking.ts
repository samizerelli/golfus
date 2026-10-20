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
