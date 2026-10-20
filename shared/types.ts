// Types partagés entre le serveur et le client.

export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const RADII_KM = [10, 25, 50, 100] as const;
export type RadiusKm = (typeof RADII_KM)[number];

/** verified = confirmé par l'administrateur ; indicative = à confirmer ; unknown = aucune donnée */
export type PriceReliability = 'verified' | 'indicative' | 'unknown';

export const PRICE_CATEGORIES = [
  'green_fee_18',
  'green_fee_9',
  'twilight',
  'buggy',
  'club_rental',
  'trolley',
  'range_balls',
  'lesson',
] as const;
export type PriceCategory = (typeof PRICE_CATEGORIES)[number];

export type Season = 'low' | 'high' | 'all';
export type DayType = 'weekday' | 'weekend' | 'all';

export interface PriceRow {
  category: PriceCategory;
  season: Season;
  dayType: DayType;
  amount: number;
  currency: Currency;
  note?: string | null;
  /** Tranche horaire de départ à laquelle s'applique ce tarif (HH:MM), ex. twilight dès 14:00 */
  fromTime?: string | null;
  toTime?: string | null;
  /** Période de validité dans l'année (MM-JJ, bornes incluses ; peut chevaucher le 1er janvier), ex. 09-28 → 11-15 */
  fromDate?: string | null;
  toDate?: string | null;
}

/** Canaux de réservation comparés : site du club (tarif officiel / remisé en ligne) et plateformes */
export const BOOKING_PLATFORMS = ['club_online', 'greenfee365'] as const;
export type BookingPlatform = (typeof BOOKING_PLATFORMS)[number];

/**
 * Prix relevé sur un canal de réservation pour une date donnée (observedFor), « à partir de », par joueur.
 * Pas de prix (amount null) = canal disponible, prix à consulter sur la plateforme.
 */
export interface BookingOffer {
  platform: BookingPlatform;
  /** greenfee365 : identifiant de la fiche (greenfee365.com/golf-course/<ref>) ; club_online : non utilisé */
  ref?: string | null;
  amount: number | null;
  currency: Currency;
  observedFor: string | null;
  note?: string | null;
}

export const SERVICE_KEYS = ['clubRental', 'drivingRange', 'restaurant', 'buggy', 'proShop', 'lessons'] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
/** true = disponible, false = absent, null/undefined = inconnu */
export type Services = Partial<Record<ServiceKey, boolean | null>>;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Course {
  name: string;
  holes: number | null;
  par: number | null;
  lengthM: number | null;
  difficulty: Difficulty | null;
}

export interface Localized {
  fr?: string;
  en?: string;
  es?: string;
}

export interface Rating {
  average: number;
  count: number;
}

export interface GolfSummary {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Distance à vol d'oiseau depuis le point de recherche (absente sur la fiche seule) */
  distanceKm?: number;
  holes: number | null;
  par: number | null;
  photo: string | null;
  phone: string | null;
  website: string | null;
  bookingUrl: string | null;
  pricingUrl: string | null;
  address: string | null;
  /** Horaires au format OSM opening_hours (ex. "Mo-Su 08:00-19:00") */
  openingHours: string | null;
  rating: Rating | null;
  prices: PriceRow[];
  priceReliability: PriceReliability;
  priceUpdatedAt: string | null;
  /** Mois de haute saison, 1 = janvier */
  highSeasonMonths: number[];
  offers: BookingOffer[];
  services: Services;
  isDemo: boolean;
  /** Le golf a été complété/corrigé dans la base locale */
  curated: boolean;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface GolfDetail extends GolfSummary {
  description: Localized;
  photos: string[];
  courses: Course[];
  email: string | null;
  reviews: Review[];
  osmUrl: string | null;
}

export interface GolfsResponse {
  golfs: GolfSummary[];
  /** true si les données OSM viennent d'un cache expiré faute de serveur disponible */
  stale: boolean;
  /** true si aucune source OSM n'a répondu (seules les données locales sont présentes) */
  osmUnavailable: boolean;
}

export interface TravelInfo {
  id: string;
  durationMin: number | null;
  distanceKm: number | null;
  /** true = estimation (pas de service d'itinéraire disponible) */
  estimated: boolean;
}

export interface PlaceSuggestion {
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
  kind: string;
}

export interface RatesResponse {
  base: 'EUR';
  date: string | null;
  rates: Record<Currency, number>;
}

/** Données éditables via l'administration */
export interface GolfEditable {
  id: string;
  name: string | null;
  lat: number | null;
  lon: number | null;
  isDemo: boolean;
  holes: number | null;
  par: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bookingUrl: string | null;
  pricingUrl: string | null;
  address: string | null;
  openingHours: string | null;
  description: Localized;
  photos: string[];
  courses: Course[];
  services: Services;
  priceReliability: PriceReliability;
  priceUpdatedAt: string | null;
  highSeasonMonths: number[];
  offers: BookingOffer[];
  prices: PriceRow[];
}
