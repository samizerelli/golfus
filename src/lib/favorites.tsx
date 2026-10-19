import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GolfSummary } from '../../shared/types';
import { readStore, writeStore } from './storage';

/** Instantané minimal conservé dans le localStorage pour afficher la liste hors ligne */
export interface FavoriteGolf {
  id: string;
  name: string;
  lat: number;
  lon: number;
  holes: number | null;
  photo: string | null;
  isDemo: boolean;
  addedAt: string;
}

interface Ctx {
  favorites: FavoriteGolf[];
  isFavorite: (id: string) => boolean;
  toggle: (g: Pick<GolfSummary, 'id' | 'name' | 'lat' | 'lon' | 'holes' | 'photo' | 'isDemo'>) => void;
}

const FavoritesContext = createContext<Ctx | null>(null);
const KEY = 'gf.favorites';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteGolf[]>(() => readStore<FavoriteGolf[]>(KEY, []));

  const toggle = useCallback<Ctx['toggle']>((g) => {
    setFavorites((prev) => {
      const next = prev.some((f) => f.id === g.id)
        ? prev.filter((f) => f.id !== g.id)
        : [
            {
              id: g.id,
              name: g.name,
              lat: g.lat,
              lon: g.lon,
              holes: g.holes,
              photo: g.photo,
              isDemo: g.isDemo,
              addedAt: new Date().toISOString(),
            },
            ...prev,
          ];
      writeStore(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const ids = new Set(favorites.map((f) => f.id));
    return { favorites, toggle, isFavorite: (id) => ids.has(id) };
  }, [favorites, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites hors du FavoritesProvider');
  return ctx;
}
