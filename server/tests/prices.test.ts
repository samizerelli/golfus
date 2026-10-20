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
