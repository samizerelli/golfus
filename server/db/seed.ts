/**
 * Script de seed — DONNÉES DE DÉMONSTRATION
 *
 * Les golfs ci-dessous sont FICTIFS : noms, tarifs, horaires et avis sont inventés pour montrer
 * l'interface. Ils sont marqués is_demo = 1 et affichés avec un badge « Données de démonstration ».
 * Masquez-les avec SHOW_DEMO_DATA=false ou supprimez-les avec : npm run seed -- --clear
 *
 * Aucun numéro de téléphone n'est inventé (pour ne jamais faire appeler un vrai numéro par erreur)
 * et les sites web pointent vers example.com.
 */
import type { GolfEditable, PriceRow } from '../../shared/types.ts';
import { db } from './index.ts';
import { saveGolf } from '../services/golfs.ts';

const gf = (
  low: [number, number],
  high: [number, number],
  currency: PriceRow['currency'] = 'EUR',
  category: PriceRow['category'] = 'green_fee_18',
): PriceRow[] => [
  { category, season: 'low', dayType: 'weekday', amount: low[0], currency },
  { category, season: 'low', dayType: 'weekend', amount: low[1], currency },
  { category, season: 'high', dayType: 'weekday', amount: high[0], currency },
  { category, season: 'high', dayType: 'weekend', amount: high[1], currency },
];
const flat = (category: PriceRow['category'], amount: number, currency: PriceRow['currency'] = 'EUR', note?: string): PriceRow => ({
  category,
  season: 'all',
  dayType: 'all',
  amount,
  currency,
  note: note ?? null,
});

const base = {
  isDemo: true,
  phone: null,
  email: null,
  website: 'https://example.com/',
  bookingUrl: 'https://example.com/booking',
  pricingUrl: 'https://example.com/tarifs',
  photos: [],
  priceUpdatedAt: '2026-10-01',
} satisfies Partial<GolfEditable>;

const demo: GolfEditable[] = [
  // ── Marbella ──
  {
    ...base,
    id: 'demo-marbella-sierra',
    name: 'Golf Démo Sierra Blanca',
    lat: 36.5275,
    lon: -4.9081,
    holes: 18,
    par: 72,
    address: 'Marbella, Málaga, Espagne (adresse fictive)',
    openingHours: 'Mo-Su 08:00-19:30',
    description: {
      fr: 'Parcours de démonstration vallonné avec vue sur la mer et la Sierra Blanca. Fairways étroits, greens rapides.',
      en: 'Demo hilly course with views of the sea and Sierra Blanca. Narrow fairways, fast greens.',
      es: 'Recorrido de demostración con vistas al mar y a Sierra Blanca. Calles estrechas, greens rápidos.',
    },
    courses: [{ name: 'Sierra', holes: 18, par: 72, lengthM: 6120, difficulty: 'hard' }],
    services: { clubRental: true, drivingRange: true, restaurant: true, buggy: true, proShop: true, lessons: true },
    priceReliability: 'verified',
    highSeasonMonths: [3, 4, 5, 10, 11],
    prices: [
      ...gf([95, 110], [145, 165]),
      flat('twilight', 75, 'EUR', 'Départ après 15 h'),
      flat('buggy', 45),
      flat('club_rental', 40),
      flat('range_balls', 4, 'EUR', 'Seau de 30 balles'),
    ],
  },
  {
    ...base,
    id: 'demo-marbella-pinar',
    name: 'Club de Golf Démo El Pinar',
    lat: 36.4812,
    lon: -5.0184,
    holes: 9,
    par: 33,
    address: 'Estepona, Málaga, Espagne (adresse fictive)',
    openingHours: 'Mo 12:00-18:00; Tu-Su 07:30-19:00',
    description: {
      fr: 'Petit 9 trous de démonstration, idéal pour une partie rapide en famille.',
      en: 'Small demo 9-hole course, ideal for a quick family round.',
      es: 'Pequeño 9 hoyos de demostración, ideal para una partida rápida en familia.',
    },
    courses: [{ name: 'Pinar', holes: 9, par: 33, lengthM: 2350, difficulty: 'easy' }],
    services: { clubRental: true, drivingRange: true, restaurant: false, buggy: false, proShop: null, lessons: true },
    priceReliability: 'indicative',
    highSeasonMonths: [3, 4, 5, 10],
    prices: [...gf([35, 40], [45, 50], 'EUR', 'green_fee_9'), flat('club_rental', 15), flat('trolley', 5)],
  },
  // ── Algarve ──
  {
    ...base,
    id: 'demo-algarve-vilamoura',
    name: 'Golfe Démo Atlântico',
    lat: 37.0956,
    lon: -8.1279,
    holes: 18,
    par: 71,
    address: 'Vilamoura, Algarve, Portugal (adresse fictive)',
    openingHours: 'Mo-Su 07:00-sunset',
    description: {
      fr: 'Parcours de démonstration bordé de pins parasols, nombreux obstacles d’eau.',
      en: 'Demo course lined with umbrella pines and many water hazards.',
      es: 'Recorrido de demostración rodeado de pinos piñoneros y con muchos obstáculos de agua.',
    },
    courses: [
      { name: 'Atlântico', holes: 18, par: 71, lengthM: 5980, difficulty: 'medium' },
      { name: 'Academy', holes: 9, par: 27, lengthM: 1050, difficulty: 'easy' },
    ],
    services: { clubRental: true, drivingRange: true, restaurant: true, buggy: true, proShop: true, lessons: true },
    priceReliability: 'verified',
    highSeasonMonths: [2, 3, 4, 5, 9, 10, 11],
    prices: [...gf([80, 80], [130, 130]), flat('green_fee_9', 55), flat('buggy', 50), flat('club_rental', 45)],
  },
  {
    ...base,
    id: 'demo-algarve-lagos',
    name: 'Golfe Démo Ponta da Rocha',
    lat: 37.1185,
    lon: -8.7072,
    holes: 18,
    par: 72,
    address: 'Lagos, Algarve, Portugal (adresse fictive)',
    // Volontairement sans horaires : illustre l'affichage « Non communiqué »
    openingHours: null,
    description: {
      fr: 'Golf de démonstration en bord de falaise. Horaires volontairement non renseignés pour illustrer l’affichage « Non communiqué ».',
      en: 'Demo clifftop golf course. Opening hours intentionally left empty to show the “Not provided” state.',
      es: 'Golf de demostración junto al acantilado. Horario vacío a propósito para mostrar el estado «No disponible».',
    },
    courses: [{ name: 'Rocha', holes: 18, par: 72, lengthM: 6300, difficulty: 'hard' }],
    services: { restaurant: true, buggy: true },
    priceReliability: 'indicative',
    highSeasonMonths: [3, 4, 5, 10],
    prices: [...gf([70, 85], [110, 120])],
  },
  // ── Côte d'Azur ──
  {
    ...base,
    id: 'demo-azur-mougins',
    name: 'Golf Démo des Collines d’Azur',
    lat: 43.6124,
    lon: 6.9921,
    holes: 18,
    par: 72,
    address: 'Mougins, Alpes-Maritimes, France (adresse fictive)',
    openingHours: 'Mo-Su 08:00-19:00; Dec 25 off',
    description: {
      fr: 'Parcours de démonstration arboré au-dessus de Cannes, ambiance club privé.',
      en: 'Wooded demo course above Cannes with a private-club feel.',
      es: 'Recorrido de demostración arbolado sobre Cannes, ambiente de club privado.',
    },
    courses: [{ name: 'Collines', holes: 18, par: 72, lengthM: 6050, difficulty: 'hard' }],
    services: { clubRental: true, drivingRange: true, restaurant: true, buggy: true, proShop: true, lessons: true },
    priceReliability: 'verified',
    highSeasonMonths: [4, 5, 6, 7, 8, 9],
    prices: [...gf([110, 130], [150, 170]), flat('buggy', 50), flat('club_rental', 50)],
  },
  {
    ...base,
    id: 'demo-azur-esterel',
    name: 'Golf Démo de l’Estérel Bleu',
    lat: 43.4498,
    lon: 6.8097,
    holes: 9,
    par: 34,
    address: 'Saint-Raphaël, Var, France (adresse fictive)',
    openingHours: 'Mo-Fr 08:30-18:30; Sa,Su 08:00-19:00',
    description: {
      fr: 'Neuf trous de démonstration entre roches rouges et pins.',
      en: 'Nine demo holes between red rocks and pines.',
      es: 'Nueve hoyos de demostración entre rocas rojas y pinos.',
    },
    courses: [{ name: 'Estérel', holes: 9, par: 34, lengthM: 2700, difficulty: 'medium' }],
    services: { clubRental: false, drivingRange: true, restaurant: true, buggy: false, proShop: false, lessons: true },
    // Aucun tarif : illustre l'affichage « Tarif non communiqué »
    priceReliability: 'unknown',
    highSeasonMonths: [],
    prices: [],
  },
  // ── Suisse romande ──
  {
    ...base,
    id: 'demo-suisse-lavaux',
    name: 'Golf Démo Lavaux-Léman',
    lat: 46.5402,
    lon: 6.7101,
    holes: 18,
    par: 70,
    address: 'Région de Lausanne, Vaud, Suisse (adresse fictive)',
    openingHours: 'Apr-Oct Mo-Su 08:00-20:00; Nov-Mar off',
    description: {
      fr: 'Parcours de démonstration en terrasses avec vue sur le Léman et les Alpes. Fermé en hiver.',
      en: 'Terraced demo course overlooking Lake Geneva and the Alps. Closed in winter.',
      es: 'Recorrido de demostración en terrazas con vistas al lago Lemán y los Alpes. Cerrado en invierno.',
    },
    courses: [{ name: 'Lavaux', holes: 18, par: 70, lengthM: 5650, difficulty: 'medium' }],
    services: { clubRental: true, drivingRange: true, restaurant: true, buggy: true, proShop: true, lessons: true },
    priceReliability: 'verified',
    highSeasonMonths: [6, 7, 8, 9],
    prices: [...gf([120, 140], [140, 160], 'CHF'), flat('buggy', 60, 'CHF'), flat('club_rental', 40, 'CHF')],
  },
  {
    ...base,
    id: 'demo-suisse-geneve',
    name: 'Golf Démo du Mandement',
    lat: 46.2268,
    lon: 6.0322,
    holes: 9,
    par: 32,
    address: 'Campagne genevoise, Genève, Suisse (adresse fictive)',
    openingHours: 'Mar-Nov Mo-Su 08:00-19:00; Dec-Feb Sa,Su 10:00-16:00',
    description: {
      fr: 'Petit parcours de démonstration au milieu des vignes, accessible aux débutants.',
      en: 'Small demo course among vineyards, beginner friendly.',
      es: 'Pequeño recorrido de demostración entre viñedos, apto para principiantes.',
    },
    courses: [{ name: 'Vignes', holes: 9, par: 32, lengthM: 2100, difficulty: 'easy' }],
    services: { clubRental: true, drivingRange: false, restaurant: false, buggy: false, proShop: false, lessons: true },
    priceReliability: 'indicative',
    highSeasonMonths: [5, 6, 7, 8, 9],
    prices: [...gf([45, 55], [55, 65], 'CHF', 'green_fee_9'), flat('club_rental', 20, 'CHF')],
  },
];

const demoReviews: [string, number, string][] = [
  ['demo-marbella-sierra', 5, 'Avis de démonstration : parcours superbe, greens en excellent état.'],
  ['demo-marbella-sierra', 4, 'Demo review: great views, a bit pricey in high season.'],
  ['demo-marbella-pinar', 4, 'Avis de démonstration : parfait pour les enfants.'],
  ['demo-algarve-vilamoura', 5, 'Reseña de demostración: campo impecable y personal muy amable.'],
  ['demo-algarve-vilamoura', 4, 'Avis de démonstration : beaucoup d’eau, prévoir des balles !'],
  ['demo-azur-mougins', 4, 'Avis de démonstration : très bel accueil.'],
  ['demo-suisse-lavaux', 5, 'Avis de démonstration : la vue sur le lac est incroyable.'],
];

/** Insère (ou remet à jour) les golfs et avis de démonstration. */
export async function seedDemo() {
  for (const g of demo) await saveGolf(g);
  await db.run('DELETE FROM reviews WHERE is_demo = 1');
  for (const [i, [id, rating, comment]] of demoReviews.entries())
    await db.run(
      "INSERT INTO reviews (golf_id, author, rating, comment, is_demo, created_at) VALUES (?, 'Visiteur (démo)', ?, ?, 1, now() - (? * interval '1 day'))",
      id,
      rating,
      comment,
      (i + 1) * 9,
    );
  return { golfs: demo.length, reviews: demoReviews.length };
}

// Exécution en ligne de commande : npm run seed [-- --clear]
if (process.argv[1]?.endsWith('seed.ts')) {
  if (process.argv.includes('--clear')) {
    await db.run('DELETE FROM reviews WHERE is_demo = 1');
    await db.run('DELETE FROM golfs WHERE is_demo = 1');
    console.log('Données de démonstration supprimées.');
  } else {
    const r = await seedDemo();
    console.log(`✅ ${r.golfs} golfs de DÉMONSTRATION et ${r.reviews} avis fictifs insérés.`);
  }
}
