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
