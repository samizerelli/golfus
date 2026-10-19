import { useSyncExternalStore } from 'react';
import type OpeningHours from 'opening_hours';

export type OpenState = 'open' | 'closed' | 'unknown';

// La bibliothèque opening_hours (~1 Mo avec les jours fériés) est chargée en différé, en parallèle
// du premier affichage. Les composants appellent useHoursLib() pour se réafficher une fois prête.
let OH: typeof OpeningHours | null = null;
const listeners = new Set<() => void>();
import('opening_hours').then((m) => {
  OH = m.default;
  listeners.forEach((l) => l());
});

export function useHoursLib() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => OH !== null,
  );
}

const cache = new Map<string, OpeningHours | null>();

/**
 * Analyse une chaîne OSM opening_hours. Les heures sont interprétées dans le fuseau de l'appareil,
 * ce qui correspond au fuseau du golf pour un voyageur sur place.
 */
export function parseHours(value: string | null, lat: number, lon: number): OpeningHours | null {
  if (!value || !OH) return null;
  const key = `${value}|${lat.toFixed(1)}|${lon.toFixed(1)}`;
  if (cache.has(key)) return cache.get(key)!;
  let oh: OpeningHours | null = null;
  try {
    oh = new OH(value, { lat, lon, address: { country_code: '', state: '' } } as never, { mode: 0 } as never);
  } catch {
    oh = null;
  }
  cache.set(key, oh);
  return oh;
}

export function stateAt(oh: OpeningHours | null, date: Date): OpenState {
  if (!oh) return 'unknown';
  try {
    if (oh.getUnknown(date)) return 'unknown';
    return oh.getState(date) ? 'open' : 'closed';
  } catch {
    return 'unknown';
  }
}

export function nextChange(oh: OpeningHours | null, date: Date): Date | null {
  if (!oh) return null;
  try {
    const limit = new Date(date.getTime() + 8 * 86400_000);
    return oh.getNextChange(date, limit) ?? null;
  } catch {
    return null;
  }
}

export interface Interval {
  from: Date;
  to: Date;
  unknown: boolean;
  comment?: string;
}

export function intervalsOn(oh: OpeningHours | null, day: Date): Interval[] | null {
  if (!oh) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  try {
    return oh
      .getOpenIntervals(start, end)
      .map(([from, to, unknown, comment]) => ({ from, to, unknown, comment: comment ?? undefined }));
  } catch {
    return null;
  }
}

export function formatIntervals(list: Interval[], locale: string) {
  const fmt = (d: Date, isEnd: boolean) =>
    isEnd && d.getHours() === 0 && d.getMinutes() === 0
      ? '24:00'
      : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  return list.map((i) => `${fmt(i.from, false)}–${fmt(i.to, true)}`).join(', ');
}

/** Lundi de la semaine contenant `date` */
export function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
