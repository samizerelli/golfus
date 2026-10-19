import type { GolfSummary } from '../../shared/types';
import { intervalsOn, parseHours } from './hours';
import { mainCategory, priceFor } from './prices';
import type { Criteria } from '../state/search';

export type Tri = boolean | null; // null = information inconnue

export interface GolfMatch {
  /** Le golf est-il ouvert pendant la plage horaire choisie ? */
  openInSlot: Tri;
  holesOk: Tri;
  ratingOk: Tri;
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
    ratingOk: c.minRating === 0 ? true : g.rating == null ? null : g.rating.average >= c.minRating,
  };
}

/** Règle : une info connue et non conforme exclut le golf ; une info inconnue l'exclut seulement si hideUnknown. */
export function passes(m: GolfMatch, c: Criteria) {
  return [m.openInSlot, m.holesOk, m.ratingOk].every((v) => v === true || (v === null && !c.hideUnknown));
}

/** Tarif par personne pour la date et le début de plage choisis (green fee principal, saison, semaine/week-end). */
export function pricePerPerson(g: GolfSummary, c: Pick<Criteria, 'date' | 'timeFrom'>) {
  const cat = mainCategory(g.prices);
  if (!cat) return null;
  return priceFor(g.prices, cat, g.highSeasonMonths, at(c.date, c.timeFrom));
}
