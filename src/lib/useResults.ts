import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TravelInfo } from '../../shared/types';
import { useSearch } from '../state/search';
import { matchGolf, passes, type GolfMatch } from './criteria';
import { api } from './api';
import { useHoursLib } from './hours';

export function useResults() {
  const { origin, radius, criteria } = useSearch();
  const hoursReady = useHoursLib();

  const golfsQ = useQuery({
    queryKey: ['golfs', origin?.lat, origin?.lon, radius],
    queryFn: ({ signal }) => api.golfs(origin!.lat, origin!.lon, radius, signal),
    enabled: !!origin,
    retry: (count, err) => count < 1 && (err as { status?: number }).status !== 400,
  });
  const all = golfsQ.data?.golfs ?? [];

  const nearest = useMemo(() => all.slice(0, 40).map((g) => ({ id: g.id, lat: g.lat, lon: g.lon })), [all]);
  const travelQ = useQuery({
    queryKey: ['travel', origin?.lat, origin?.lon, nearest.map((n) => n.id).join(',')],
    queryFn: () => api.travel(origin!.lat, origin!.lon, nearest),
    enabled: !!origin && nearest.length > 0,
    staleTime: 30 * 60_000,
  });
  const travel = useMemo(() => {
    const m = new Map<string, TravelInfo>();
    for (const t of travelQ.data ?? []) m.set(t.id, t);
    return m;
  }, [travelQ.data]);
  const travelLoading = travelQ.isLoading;

  // Critères de l'écran 1 appliqués réellement ; tri par distance
  const { visible, matches } = useMemo(() => {
    const matches = new Map<string, GolfMatch>();
    for (const g of all) matches.set(g.id, matchGolf(g, criteria));
    // Parcours disponibles : rien de connu ne les exclut (fermé sur le créneau, mauvais nombre de trous, note trop basse)
    // et on peut les joindre pour réserver (téléphone, site ou lien de réservation).
    // Ceux dont l'ouverture sur le créneau est confirmée passent en premier, puis tri par distance.
    const reachable = (g: (typeof all)[number]) => !!(g.phone || g.website || g.bookingUrl);
    const confirmed = (id: string) => (matches.get(id)!.openInSlot === true ? 0 : 1);
    const visible = all
      .filter((g) => reachable(g) && passes(matches.get(g.id)!, criteria))
      .sort((a, b) => confirmed(a.id) - confirmed(b.id) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return { visible, matches };
    // hoursReady : on recalcule quand la bibliothèque d'horaires est chargée
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, criteria, hoursReady]);

  return { golfsQ, all, visible, matches, travel, travelLoading };
}
