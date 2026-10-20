import type { GolfSummary } from '../../shared/types';

export function golfName(g: GolfSummary, unnamed: string) {
  return g.name || unnamed;
}

/** Nom CSS de transition partagée (View Transitions API) pour la photo d'un golf */
export const vtName = (id: string) => `golf-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
