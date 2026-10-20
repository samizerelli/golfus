import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowed, parseRobots } from '../lib/robots.ts';
import { findPrices } from '../services/siteExtract.ts';

test('robots.txt : Disallow et Allow les plus précis l’emportent', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nUser-agent: BadBot\nDisallow: /');
  assert.equal(isAllowed(rules, '/tarifas/'), true);
  assert.equal(isAllowed(rules, '/wp-admin/options.php'), false);
  assert.equal(isAllowed(rules, '/wp-admin/admin-ajax.php'), true);
});

test('robots.txt : un groupe dédié à GolfUs prime sur *', () => {
  const rules = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: GolfUs\nDisallow: /');
  assert.equal(isAllowed(rules, '/tarifs'), false);
});

test('tarifs : libellé, montant, catégorie et saison', () => {
  const text = 'TEMPORADA BAJA | Greenfee 18 hoyos + buggy: 139€ | Greenfee 9 hoyos: 80€ | Twilight: 118€ | Junior 18 hoyos: 74€ | Block 10 tickets: 1.265€';
  const p = findPrices(text, 'https://exemple.golf/tarifas/');
  const byLabel = Object.fromEntries(p.map((x) => [x.label, x]));
  assert.equal(byLabel['Greenfee 18 hoyos + buggy'].amount, 139);
  assert.equal(byLabel['Greenfee 18 hoyos + buggy'].category, 'green_fee_18');
  assert.equal(byLabel['Greenfee 18 hoyos + buggy'].season, 'low');
  assert.equal(byLabel['Greenfee 9 hoyos'].category, 'green_fee_9');
  assert.equal(byLabel['Twilight'].category, 'twilight');
  // Les tarifs spéciaux sont relevés mais jamais proposés cochés
  assert.equal(byLabel['Junior 18 hoyos'].suggested, false);
});

test('tarifs : montants hors plage ou sans libellé ignorés', () => {
  assert.equal(findPrices('€ 2 | 25000 €', 'https://x.golf/').length, 0);
});
