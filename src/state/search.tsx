import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RadiusKm, ServiceKey } from '../../shared/types';

export interface Origin {
  lat: number;
  lon: number;
  label: string | null;
  /** gps = position de l'appareil ; ip = approximative (ville) ; search = lieu saisi */
  source: 'gps' | 'ip' | 'search';
}

export type SortKey = 'distance' | 'price' | 'rating';
export type HolesFilter = 'any' | '9' | '18';

export interface Filters {
  /** Green fee max, exprimé en EUR (la conversion est faite à l'affichage) */
  maxPriceEur: number | null;
  holes: HolesFilter;
  openAtTime: boolean;
  services: ServiceKey[];
}

export const DEFAULT_FILTERS: Filters = { maxPriceEur: null, holes: 'any', openAtTime: false, services: [] };

export function activeFilterCount(f: Filters) {
  return (f.maxPriceEur !== null ? 1 : 0) + (f.holes !== 'any' ? 1 : 0) + (f.openAtTime ? 1 : 0) + f.services.length;
}

/** Critères de l'écran 1 (filtrent réellement les résultats de l'écran 2) */
export interface Criteria {
  /** Date de jeu AAAA-MM-JJ */
  date: string;
  /** Plage horaire de départ souhaitée */
  timeFrom: string;
  timeTo: string;
  holes: HolesFilter;
  /** Note minimale (0 = toutes) */
  minRating: number;
  players: number;
  /** Masquer les golfs dont une information filtrée (horaires, trous, note) est inconnue */
  hideUnknown: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const DEFAULT_CRITERIA = (): Criteria => ({ date: todayStr(), timeFrom: '08:00', timeTo: '18:00', holes: 'any', minRating: 0, players: 2, hideUnknown: false });

export type View = 'search' | 'results';

interface Ctx {
  criteria: Criteria;
  setCriteria: (c: Partial<Criteria>) => void;
  view: View;
  setView: (v: View) => void;
  origin: Origin | null;
  setOrigin: (o: Origin | null) => void;
  radius: RadiusKm;
  setRadius: (r: RadiusKm) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Date (AAAA-MM-JJ) et heure (HH:MM) de jeu ; null = maintenant */
  playDate: string | null;
  playTime: string | null;
  setPlay: (date: string | null, time: string | null) => void;
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
  const [radius, setRadius] = useState<RadiusKm>(25);
  const [sort, setSort] = useState<SortKey>('distance');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [playDate, setPlayDate] = useState<string | null>(null);
  const [playTime, setPlayTime] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [criteria, setCriteriaState] = useState<Criteria>(DEFAULT_CRITERIA);
  const [view, setView] = useState<View>('search');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Ctx>(() => {
    // Instant de référence (statut ouvert/fermé, saison, semaine/week-end) : début de la plage choisie,
    // ou maintenant si l'on est aujourd'hui en pleine plage horaire
    const [h, m] = (playTime ?? criteria.timeFrom).split(':').map(Number);
    const start = new Date(`${playDate ?? criteria.date}T00:00:00`);
    start.setHours(h, m, 0, 0);
    const [eh, em] = criteria.timeTo.split(':').map(Number);
    const end = new Date(start);
    end.setHours(eh, em, 0, 0);
    const isNow = now >= start && now <= end;
    const playAt = isNow ? now : start;
    return {
      criteria,
      setCriteria: (c) => setCriteriaState((prev) => ({ ...prev, ...c })),
      view,
      setView,
      origin,
      setOrigin: (o) => {
        setOrigin(o);
        setSelectedId(null);
      },
      radius,
      setRadius,
      sort,
      setSort,
      filters,
      setFilters,
      playDate,
      playTime,
      setPlay: (d, t) => {
        setPlayDate(d);
        setPlayTime(t);
      },
      playAt,
      isNow,
      selectedId,
      setSelectedId,
      hoverId,
      setHoverId,
    };
  }, [hoverId, origin, radius, sort, filters, playDate, playTime, selectedId, now, criteria, view]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch hors du SearchProvider');
  return ctx;
}
