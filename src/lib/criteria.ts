import type { GolfSummary, PriceRow } from '../../shared/types';
import { intervalsOn, parseHours } from './hours';
import { applicablePrices, mainCategory } from './prices';
import type { Criteria } from '../state/search';

export type Tri = boolean | null; // null = information inconnue

export interface GolfMatch {
  /** Le golf est-il ouvert pendant la plage horaire choisie ? */
  openInSlot: Tri;
  holesOk: Tri;
}

const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Ouvert à un moment de la plage [de, à] le jour choisi (null si horaires inconnus ou non interprétables). */
export function openDuringSlot(g: GolfSummary, c: Pick<Criteria, 'date' | 'timeFrom' | 'timeTo'>): Tri {
  const oh = parseHours(g.openingHours, g.lat, g.lon);
  if (!oh) return null;
  const list = intervalsOn(oh, at(c.date, '00:00'));
  if (!list) return null;
  const s = at(c.date, c.timeFrom).getTime();
  const e = at(c.date, c.timeTo).getTime();
  if (list.some((i) => i.unknown)) return null;
  return list.some((i) => i.from.getTime() < e && i.to.getTime() > s);
}

export function matchGolf(g: GolfSummary, c: Criteria): GolfMatch {
  return {
    openInSlot: openDuringSlot(g, c),
    holesOk: c.holes === 'any' ? true : g.holes == null ? null : c.holes === '9' ? g.holes <= 9 : g.holes >= 18,
  };
}

/** Règle : une info connue et non conforme exclut le golf ; une info inconnue l'exclut seulement si hideUnknown. */
export function passes(m: GolfMatch, c: Criteria) {
  return [m.openInSlot, m.holesOk].every((v) => v === true || (v === null && !c.hideUnknown));
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Tarif par personne pour la date et la plage de départ choisies (saison, semaine/week-end, tranche horaire).
 * Les tarifs à tranche horaire (early bird, twilight…) ne comptent que si la tranche croise la plage choisie.
 * Renvoie le moins cher applicable ; `varies` = plusieurs tarifs possibles dans la plage (affiché « dès »).
 */
export function pricePerPerson(g: GolfSummary, c: Pick<Criteria, 'date' | 'timeFrom'> & Partial<Pick<Criteria, 'timeTo'>>) {
  const cat = mainCategory(g.prices);
  if (!cat) return null;
  const date = at(c.date, c.timeFrom);
  const s = toMin(c.timeFrom);
  const e = toMin(c.timeTo ?? c.timeFrom) || s;
  const inSlot = (p: PriceRow) => {
    if (!p.fromTime && !p.toTime) return true;
    const a = p.fromTime ? toMin(p.fromTime) : 0;
    const b = p.toTime ? toMin(p.toTime) : 24 * 60;
    return a <= Math.max(s, e) && b > s;
  };
  // Lignes de la catégorie principale + twilight (seulement si son heure de début est connue)
  const rows = g.prices.filter((p) => (p.category === cat || (p.category === 'twilight' && p.fromTime)) && inSlot(p));
  const options = [cat, 'twilight' as const]
    .flatMap((k) => {
      // Par tranche horaire distincte : le tarif le plus spécifique pour la saison et le jour
      const windows = new Map<string, PriceRow[]>();
      for (const p of rows.filter((r) => r.category === k)) windows.set(`${p.fromTime}-${p.toTime}`, [...(windows.get(`${p.fromTime}-${p.toTime}`) ?? []), p]);
      return [...windows.values()].flatMap((list) => applicablePrices(list, k, g.highSeasonMonths, date));
    });
  if (!options.length) return null;
  const sorted = options.sort((a, b) => a.amount - b.amount);
  return Object.assign({}, sorted[0], { varies: new Set(sorted.map((p) => p.amount)).size > 1 });
}

/**
 * Tarif fin de journée (twilight) moins cher, hors de la plage choisie : à signaler, car la page de réservation
 * du club montre souvent ces départs de l'après-midi à prix réduit (ex. 136 € au lieu de 177 € le matin).
 */
export function cheaperLater(g: GolfSummary, c: Pick<Criteria, 'date' | 'timeFrom' | 'timeTo'>) {
  const pp = pricePerPerson(g, c);
  if (!pp) return null;
  const date = at(c.date, c.timeFrom);
  const tw = applicablePrices(g.prices.filter((p) => p.category === 'twilight'), 'twilight', g.highSeasonMonths, date).sort((a, b) => a.amount - b.amount)[0];
  if (!tw || tw.amount >= pp.amount - 0.5) return null;
  // Déjà dans la plage choisie (heure de début connue et avant la fin de la plage) : rien à signaler
  if (tw.fromTime && toMin(tw.fromTime) < toMin(c.timeTo)) return null;
  return { amount: tw.amount, currency: tw.currency, fromTime: tw.fromTime ?? null };
}
