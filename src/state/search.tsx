import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RadiusKm } from '../../shared/types';

export interface Origin {
  lat: number;
  lon: number;
  label: string | null;
  /** gps = position de l'appareil ; ip = approximative (ville) ; search = lieu saisi */
  source: 'gps' | 'ip' | 'search';
}

export type SortKey = 'distance' | 'price' | 'rating';
export type HolesFilter = 'any' | '9' | '18';

/** Critères de l'écran 1 (filtrent réellement les résultats de l'écran 2) */
export interface Criteria {
  /** Date de jeu AAAA-MM-JJ */
  date: string;
  /** Plage horaire de départ souhaitée */
  timeFrom: string;
  timeTo: string;
  holes: HolesFilter;
  players: number;
  /** Masquer les golfs dont une information filtrée (horaires, trous) est inconnue */
  hideUnknown: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const SLOT_MIN = 6 * 60;
const SLOT_MAX = 21 * 60;
const SLOT_LEN = 3 * 60;

/**
 * Créneau par défaut = heure actuelle de l'appareil (fuseau local), arrondie à la demi-heure la plus proche
 * (13:02 → 13:00, 13:20 → 13:30), sur 3 heures. Après 20:30 : le lendemain à partir de 08:00.
 */
export function defaultSlot(now = new Date()): Pick<Criteria, 'date' | 'timeFrom' | 'timeTo'> {
  const rounded = Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  if (rounded > SLOT_MAX - 30) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, timeFrom: '08:00', timeTo: hhmm(8 * 60 + SLOT_LEN) };
  }
  const from = Math.max(SLOT_MIN, rounded);
  return { date: todayStr(), timeFrom: hhmm(from), timeTo: hhmm(Math.min(SLOT_MAX, from + SLOT_LEN)) };
}

export const DEFAULT_CRITERIA = (): Criteria => ({ ...defaultSlot(), holes: 'any', players: 2, hideUnknown: false });

/** Filtres repris de l'adresse (?date=&from=&to=&holes=&players=&radius=) ; valeurs invalides ignorées. La position n'y figure jamais. */
export function criteriaFromUrl(search: string): { criteria: Criteria; radius: RadiusKm | null } {
  const q = new URLSearchParams(search);
  const c = DEFAULT_CRITERIA();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const date = q.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayStr()) c.date = date;
  const from = q.get('from');
  const to = q.get('to');
  if (from && to && time.test(from) && time.test(to) && from < to) Object.assign(c, { timeFrom: from, timeTo: to });
  const holes = q.get('holes');
  if (holes === '9' || holes === '18' || holes === 'any') c.holes = holes;
  const players = Number(q.get('players'));
  if (Number.isInteger(players) && players >= 1 && players <= 8) c.players = players;
  const r = Number(q.get('radius'));
  return { criteria: c, radius: [10, 25, 50, 100].includes(r) ? (r as RadiusKm) : null };
}

interface Ctx {
  /** Critères appliqués aux résultats (mis à jour 250 ms après le dernier changement) */
  criteria: Criteria;
  /** Valeurs affichées dans les filtres (mises à jour immédiatement) */
  draft: Criteria;
  setCriteria: (c: Partial<Criteria>) => void;
  /** Centre de carte de repli quand la position n'est pas disponible */
  mapHint: { lat: number; lon: number } | null;
  setMapHint: (p: { lat: number; lon: number } | null) => void;
  origin: Origin | null;
  setOrigin: (o: Origin | null) => void;
  radius: RadiusKm;
  setRadius: (r: RadiusKm) => void;
  playAt: Date;
  isNow: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** Golf survolé dans la liste : simple surbrillance sur la carte, sans déplacer la carte */
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
}

const SearchContext = createContext<Ctx | null>(null);

/**
 * État de recherche gardé uniquement en mémoire : la position n'est écrite ni dans le navigateur
 * (localStorage, URL) ni sur le serveur.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [initial] = useState(() => criteriaFromUrl(window.location.pathname === '/' ? window.location.search : ''));
  const [radius, setRadius] = useState<RadiusKm>(initial.radius ?? 25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Criteria>(initial.criteria);
  const [criteria, setApplied] = useState<Criteria>(initial.criteria);
  const [mapHint, setMapHint] = useState<{ lat: number; lon: number } | null>(null);

  // Filtres appliqués en direct, avec 250 ms de délai (curseurs) pour éviter les requêtes inutiles
  useEffect(() => {
    if (draft === criteria) return;
    const id = setTimeout(() => setApplied(draft), 250);
    return () => clearTimeout(id);
  }, [draft, criteria]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Ctx>(() => {
    // Instant de référence (statut ouvert/fermé, saison, semaine/week-end) : début de la plage choisie,
    // ou maintenant si l'on est aujourd'hui en pleine plage horaire
    const [h, m] = criteria.timeFrom.split(':').map(Number);
    const start = new Date(`${criteria.date}T00:00:00`);
    start.setHours(h, m, 0, 0);
    const [eh, em] = criteria.timeTo.split(':').map(Number);
    const end = new Date(start);
    end.setHours(eh, em, 0, 0);
    const isNow = now >= start && now <= end;
    const playAt = isNow ? now : start;
    return {
      criteria,
      draft,
      setCriteria: (c) => setDraft((prev) => ({ ...prev, ...c })),
      mapHint,
      setMapHint,
      origin,
      setOrigin: (o) => {
        setOrigin(o);
        setSelectedId(null);
      },
      radius,
      setRadius,
      playAt,
      isNow,
      selectedId,
      setSelectedId,
      hoverId,
      setHoverId,
    };
  }, [hoverId, origin, radius, selectedId, now, criteria, draft, mapHint]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch hors du SearchProvider');
  return ctx;
}
