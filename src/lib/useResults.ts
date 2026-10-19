import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { GolfSummary, TravelInfo } from '../../shared/types';
import { useSearch, type Filters } from '../state/search';
import { api } from './api';
import { parseHours, stateAt, useHoursLib } from './hours';
import { minGreenFee } from './prices';
import { useSettings } from './settings';

function passes(g: GolfSummary, f: Filters, playAt: Date, minEur: number | null) {
  if (f.maxPriceEur !== null && (minEur === null || minEur > f.maxPriceEur + 0.5)) return false;
  if (f.holes === '9' && !(g.holes !== null && g.holes <= 9)) return false;
  if (f.holes === '18' && !(g.holes !== null && g.holes >= 18)) return false;
  if (f.openAtTime && stateAt(parseHours(g.openingHours, g.lat, g.lon), playAt) !== 'open') return false;
  for (const s of f.services) if (g.services[s] !== true) return false;
  return true;
}

export function useResults() {
  const { origin, radius, filters, sort, playAt } = useSearch();
  const { convert } = useSettings();
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

  const visible = useMemo(() => {
    const withMin = all.map((g) => ({ g, min: minGreenFee(g, convert) }));
    const list = withMin.filter(({ g, min }) => passes(g, filters, playAt, min));
    const byDist = (a: GolfSummary, b: GolfSummary) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    if (sort === 'price') list.sort((a, b) => (a.min ?? Infinity) - (b.min ?? Infinity) || byDist(a.g, b.g));
    else if (sort === 'rating')
      list.sort((a, b) => (b.g.rating?.average ?? -1) - (a.g.rating?.average ?? -1) || byDist(a.g, b.g));
    else list.sort((a, b) => byDist(a.g, b.g));
    return list.map((x) => x.g);
  }, [all, filters, sort, playAt, convert, hoursReady]);

  return { golfsQ, all, visible, travel, travelLoading };
}
