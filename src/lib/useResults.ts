import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TravelInfo } from '../../shared/types';
import { useSearch } from '../state/search';
import { matchGolf, passes, type GolfMatch } from './criteria';
import { api } from './api';
import { useHoursLib } from './hours';

export function useResults() {
  const { origin, radius, criteria, draft } = useSearch();
  const hoursReady = useHoursLib();

  const golfsQ = useQuery({
    queryKey: ['golfs', origin?.lat, origin?.lon, radius],
    queryFn: ({ signal }) => api.golfs(origin!.lat, origin!.lon, radius, signal),
    enabled: !!origin,
    retry: (count, err) => count < 1 && (err as { status?: number }).status !== 400,
    // Changement de rayon : les résultats précédents restent affichés jusqu'aux nouveaux (même point de départ)
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === origin?.lat && prevQuery?.queryKey[2] === origin?.lon ? prev : undefined),
  });
  // Rayon réduit : les golfs déjà chargés hors du nouveau cercle disparaissent tout de suite, sans attendre le serveur
  const all = useMemo(() => (golfsQ.data?.golfs ?? []).filter((g) => g.distanceKm == null || g.distanceKm <= radius), [golfsQ.data, radius]);

  const nearest = useMemo(() => all.slice(0, 40).map((g) => ({ id: g.id, lat: g.lat, lon: g.lon })), [all]);
  const travelQ = useQuery({
    queryKey: ['travel', origin?.lat, origin?.lon, nearest.map((n) => n.id).join(',')],
    queryFn: ({ signal }) => api.travel(origin!.lat, origin!.lon, nearest, signal),
    enabled: !!origin && nearest.length > 0,
    staleTime: 30 * 60_000,
  });
  const travel = useMemo(() => {
    const m = new Map<string, TravelInfo>();
    for (const t of travelQ.data ?? []) m.set(t.id, t);
    return m;
  }, [travelQ.data]);
  const travelLoading = travelQ.isLoading;

  // Départs libres (jour, créneau, joueurs) pour les golfs dont le moteur de réservation le publie
  const ids = useMemo(() => all.filter((g) => g.curated).map((g) => g.id).slice(0, 60), [all]);
  const availQ = useQuery({
    queryKey: ['availability', ids.join(','), criteria.date, criteria.timeFrom, criteria.timeTo, criteria.players],
    queryFn: ({ signal }) => api.availability(ids, criteria.date, criteria.timeFrom, criteria.timeTo, criteria.players, signal),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
  const avail = availQ.data;

  // Critères de l'écran 1 appliqués réellement ; tri par distance
  const { visible, matches } = useMemo(() => {
    const matches = new Map<string, GolfMatch>();
    for (const g of all) matches.set(g.id, matchGolf(g, criteria));
    // Parcours disponibles : rien de connu ne les exclut (fermé sur le créneau, mauvais nombre de trous, note trop basse)
    // et on peut les joindre pour réserver (téléphone, site ou lien de réservation).
    // Ceux dont l'ouverture sur le créneau est confirmée passent en premier, puis tri par distance.
    // Seuls les golfs dont l'indisponibilité est connue sont écartés : complet sur le créneau pour ce nombre de joueurs.
    // Ceux dont le moteur ne publie pas les départs restent proposés (« disponibilité à vérifier »).
    const reachable = (g: (typeof all)[number]) => !!(g.phone || g.website || g.bookingUrl || g.offers?.length);
    const full = (id: string) => avail?.[id]?.status === 'full';
    // Ordre : départs libres confirmés, puis ouverture confirmée sur le créneau, puis le reste ; ensuite la distance
    const rank = (id: string) => (avail?.[id]?.status === 'available' ? 0 : matches.get(id)!.openInSlot === true ? 1 : 2);
    const visible = all
      .filter((g) => reachable(g) && !full(g.id) && passes(matches.get(g.id)!, criteria))
      .sort((a, b) => rank(a.id) - rank(b.id) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return { visible, matches };
    // hoursReady : on recalcule quand la bibliothèque d'horaires est chargée
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, criteria, hoursReady, avail]);

  // Clubs retirés car complets : nommés sous le compteur (rien n'est masqué sans le dire)
  const hiddenFull = avail ? all.filter((g) => avail[g.id]?.status === 'full').map((g) => g.name) : [];
  // Rafraîchissement en cours (nouveau rayon, filtres pas encore appliqués, disponibilités) : résultats conservés, état léger
  const refreshing = (golfsQ.isFetching && !!golfsQ.data) || availQ.isFetching || draft !== criteria;
  return { golfsQ, all, visible, matches, travel, travelLoading, avail, availLoading: availQ.isFetching, hiddenFull, refreshing };
}
