import type { Currency, DayType, GolfSummary, PriceCategory, PriceRow, Season } from '../../shared/types';

export function seasonFor(highSeasonMonths: number[], date: Date): Exclude<Season, 'all'> | null {
  if (!highSeasonMonths.length) return null;
  return highSeasonMonths.includes(date.getMonth() + 1) ? 'high' : 'low';
}

export function dayTypeFor(date: Date): Exclude<DayType, 'all'> {
  const d = date.getDay();
  return d === 0 || d === 6 ? 'weekend' : 'weekday';
}

/** Catégorie de green fee principale : 18 trous si disponible, sinon 9 trous */
export function mainCategory(prices: PriceRow[]): PriceCategory | null {
  if (prices.some((p) => p.category === 'green_fee_18')) return 'green_fee_18';
  if (prices.some((p) => p.category === 'green_fee_9')) return 'green_fee_9';
  return null;
}

/** La date tombe-t-elle dans la période MM-JJ → MM-JJ de la ligne (période pouvant chevaucher le 1er janvier) ? */
export function inDateRange(p: Pick<PriceRow, 'fromDate' | 'toDate'>, date: Date) {
  if (!p.fromDate && !p.toDate) return true;
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const a = p.fromDate ?? '01-01';
  const b = p.toDate ?? '12-31';
  return a <= b ? d >= a && d <= b : d >= a || d <= b;
}

/**
 * Toutes les lignes applicables à une date avec la meilleure spécificité (période datée, saison, type de jour).
 * Plusieurs lignes = plusieurs parcours ou formules au même moment (ex. Campo Norte / Campo Sur).
 */
export function applicablePrices(prices: PriceRow[], category: PriceCategory, highSeasonMonths: number[], date: Date): PriceRow[] {
  const season = seasonFor(highSeasonMonths, date);
  const day = dayTypeFor(date);
  const dated = prices.some((p) => p.category === category && (p.fromDate || p.toDate));
  const candidates = prices
    .filter((p) => p.category === category)
    .filter((p) => inDateRange(p, date))
    // Avec des périodes datées, la saison est déjà portée par la date
    .filter((p) => dated || p.season === 'all' || season === null || p.season === season)
    .filter((p) => p.dayType === 'all' || p.dayType === day)
    .map((p) => ({ p, score: (p.fromDate || p.toDate ? 4 : 0) + (p.season !== 'all' && p.season === season ? 2 : 0) + (p.dayType === day ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  // Sans saison définie et avec des lignes saisonnières, on ne peut pas trancher : toutes sont possibles
  if (!dated && season === null && candidates.some((c) => c.p.season !== 'all')) return candidates.map((c) => c.p);
  const best = candidates[0]?.score;
  return candidates.filter((c) => c.score === best).map((c) => c.p);
}

/** Tarif applicable à une date : le moins cher parmi les lignes les plus spécifiques. */
export function priceFor(prices: PriceRow[], category: PriceCategory, highSeasonMonths: number[], date: Date) {
  return applicablePrices(prices, category, highSeasonMonths, date).sort((a, b) => a.amount - b.amount)[0] ?? null;
}

export function priceMatrix(prices: PriceRow[], category: PriceCategory) {
  const get = (season: Season, day: DayType) =>
    prices.find((p) => p.category === category && p.season === season && p.dayType === day) ??
    prices.find((p) => p.category === category && p.season === season && p.dayType === 'all') ??
    prices.find((p) => p.category === category && p.season === 'all' && p.dayType === day) ??
    prices.find((p) => p.category === category && p.season === 'all' && p.dayType === 'all') ??
    null;
  const seasonal = prices.some((p) => p.category === category && p.season !== 'all');
  const daily = prices.some((p) => p.category === category && p.dayType !== 'all');
  return {
    seasonal,
    daily,
    rows: (seasonal ? (['low', 'high'] as const) : (['all'] as const)).map((s) => ({
      season: s as Season,
      weekday: get(s, daily ? 'weekday' : 'all'),
      weekend: daily ? get(s, 'weekend') : null,
    })),
  };
}

/** Ligne de green fee la moins chère (pour « à partir de »), comparée en EUR */
export function cheapestGreenFee(g: GolfSummary, convert: (a: number, from: Currency, to?: Currency) => number | null) {
  const cat = mainCategory(g.prices);
  if (!cat) return null;
  const eur = (p: PriceRow) => convert(p.amount, p.currency, 'EUR') ?? p.amount;
  return g.prices.filter((p) => p.category === cat).sort((a, b) => eur(a) - eur(b))[0] ?? null;
}
