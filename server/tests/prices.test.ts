import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PriceRow } from '../../shared/types.ts';
import { applicablePrices, inDateRange, priceFor } from '../../src/lib/prices.ts';

const row = (p: Partial<PriceRow> & Pick<PriceRow, 'amount'>): PriceRow => ({ category: 'green_fee_18', season: 'all', dayType: 'all', currency: 'EUR', ...p });
const d = (s: string) => new Date(`${s}T10:00:00`);

test('période datée, y compris à cheval sur le 1er janvier', () => {
  assert.equal(inDateRange({ fromDate: '09-28', toDate: '11-15' }, d('2026-10-20')), true);
  assert.equal(inDateRange({ fromDate: '09-28', toDate: '11-15' }, d('2026-11-16')), false);
  assert.equal(inDateRange({ fromDate: '12-01', toDate: '01-31' }, d('2027-01-10')), true);
  assert.equal(inDateRange({ fromDate: '12-01', toDate: '01-31' }, d('2026-06-10')), false);
});

test('le tarif de la période en cours est retenu, rien hors des périodes publiées', () => {
  const prices = [row({ amount: 139, fromDate: '05-14', toDate: '09-27' }), row({ amount: 177, fromDate: '09-28', toDate: '11-15' })];
  assert.equal(priceFor(prices, 'green_fee_18', [], d('2026-10-20'))?.amount, 177);
  assert.equal(priceFor(prices, 'green_fee_18', [], d('2026-07-01'))?.amount, 139);
  // Période non publiée : aucun tarif inventé
  assert.equal(priceFor(prices, 'green_fee_18', [], d('2026-03-01')), null);
});

test('plusieurs parcours au même moment : tous proposés, le moins cher en premier', () => {
  const prices = [row({ amount: 180, note: 'Sur' }), row({ amount: 115, note: 'Norte' })];
  assert.deepEqual(applicablePrices(prices, 'green_fee_18', [], d('2026-10-20')).map((p) => p.amount).sort(), [115, 180]);
  assert.equal(priceFor(prices, 'green_fee_18', [], d('2026-10-20'))?.amount, 115);
});

test('lien de réservation pré-rempli selon le moteur du golf', async () => {
  const { prefilledBookingUrl } = await import('../../src/lib/booking.ts');
  const p = { date: '2026-10-22', timeFrom: '08:00', timeTo: '12:00', players: 3 };
  const teeone = prefilledBookingUrl('https://open.teeone.golf/es/santamaria/disponibilidad', p);
  assert.equal(teeone.url, 'https://open.teeone.golf/es/santamaria/disponibilidad?fecha=20261022&numJug=3&hora=m');
  // Plage à cheval sur midi : pas de filtre matin / après-midi ; 6 joueurs → départs à 4 places
  assert.equal(
    prefilledBookingUrl('https://open.teeone.golf/es/santamaria/disponibilidad', { ...p, timeTo: '18:00', players: 6 }).url,
    'https://open.teeone.golf/es/santamaria/disponibilidad?fecha=20261022&numJug=4',
  );
  assert.equal(prefilledBookingUrl('https://alhaurin.golfmanager.com/consumer/ebookings?i=1', p).url, 'https://alhaurin.golfmanager.com/consumer/ebookings?i=1&date=2026-10-22');
  assert.equal(prefilledBookingUrl('https://reservas-golf.rioreal.com/reserva', p).url, 'https://reservas-golf.rioreal.com/reserva/fecha:2026-10-22');
  assert.equal(prefilledBookingUrl('https://reservas72.miraflores-golf.com/', p).filled.date, false);
});

test('comparatif : du moins cher au plus cher, liens datés, aucun prix inventé', async () => {
  const { bookingChoices, cheaperElsewhere } = await import('../../src/lib/booking.ts');
  const golf = {
    id: 'g', name: 'Golf', lat: 0, lon: 0, holes: 18, par: 72, photo: null, phone: null, website: null,
    bookingUrl: 'https://open.teeone.golf/es/test/disponibilidad', pricingUrl: null, address: null, openingHours: null, rating: null,
    prices: [row({ amount: 139 })], priceReliability: 'indicative' as const, priceUpdatedAt: null, highSeasonMonths: [], services: {}, isDemo: false, curated: true,
    offers: [
      { platform: 'greenfee365' as const, ref: 'test-golf', amount: 104.38, currency: 'EUR' as const, observedFor: '2026-10-22' },
      { platform: 'greenfee365' as const, ref: 'autre', amount: null, currency: 'EUR' as const, observedFor: null },
      { platform: 'club_online' as const, amount: 130, currency: 'EUR' as const, observedFor: '2026-10-20' },
    ],
  };
  const c = { date: '2026-10-24', timeFrom: '08:00', timeTo: '12:00', holes: 'any' as const, players: 2, hideUnknown: false };
  const list = bookingChoices(golf, c);
  assert.deepEqual(list.map((x) => [x.kind, x.amount]), [['platform', 104.38], ['club_online', 130], ['club', 139], ['platform', null]]);
  assert.equal(list[0].cheapest, true);
  assert.equal(list[0].url, 'https://greenfee365.com/golf-course/test-golf?date=2026-10-24');
  assert.equal(list.find((x) => x.kind === 'club')?.basis, 'date');
  assert.equal(cheaperElsewhere(golf, c)?.amount, 104.38);
});

test('créneau par défaut = heure de l’appareil arrondie, filtres repris de l’adresse', async () => {
  const { defaultSlot, criteriaFromUrl } = await import('../../src/state/search.tsx');
  const at = (h: number, m: number) => new Date(2026, 9, 21, h, m);
  assert.deepEqual(defaultSlot(at(13, 2)), { date: '2026-10-21', timeFrom: '13:00', timeTo: '16:00' });
  assert.equal(defaultSlot(at(13, 20)).timeFrom, '13:30');
  assert.equal(defaultSlot(at(19, 40)).timeTo, '21:00');
  // Trop tôt : début de journée ; trop tard : le lendemain matin
  assert.equal(defaultSlot(at(5, 0)).timeFrom, '06:00');
  assert.deepEqual(defaultSlot(at(21, 10)), { date: '2026-10-22', timeFrom: '08:00', timeTo: '11:00' });
  const u = criteriaFromUrl('?date=2099-01-02&from=09:00&to=12:00&holes=18&players=3&radius=50&lat=1');
  assert.deepEqual([u.criteria.date, u.criteria.timeFrom, u.criteria.timeTo, u.criteria.holes, u.criteria.players, u.radius], ['2099-01-02', '09:00', '12:00', '18', 3, 50]);
  // Valeurs invalides ignorées
  const bad = criteriaFromUrl('?from=12:00&to=09:00&players=99&radius=7&holes=x');
  assert.equal(bad.radius, null);
  assert.equal(bad.criteria.players, 2);
  assert.equal(bad.criteria.holes, '18');
});
