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

interface Ctx {
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Ctx>(() => {
    const isNow = !playDate && !playTime;
    let playAt = now;
    if (!isNow) {
      const base = playDate ? new Date(`${playDate}T00:00:00`) : new Date(now);
      const [h, m] = (playTime ?? '10:00').split(':').map(Number);
      base.setHours(h, m, 0, 0);
      playAt = base;
    }
    return {
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
    };
  }, [origin, radius, sort, filters, playDate, playTime, selectedId, now]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch hors du SearchProvider');
  return ctx;
}
