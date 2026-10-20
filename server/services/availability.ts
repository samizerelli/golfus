/**
 * Disponibilité réelle des départs (jour, créneau, nombre de joueurs) quand le moteur de réservation du golf
 * la publie sans connexion.
 *
 * - Golfmanager (*.golfmanager.com) : la page publique de réservation charge /ebookings/searchAvailability.api
 *   (départs libres et places restantes). Pas de robots.txt ; interrogé seulement lors d'une recherche,
 *   mis en cache 10 minutes par golf et par jour, avec un User-Agent identifiable.
 * - Les autres moteurs (TeeOne, iMaster…) n'ouvrent pas cet accès : statut « unknown », le golf reste proposé.
 *
 * Règle : seul un golf dont l'indisponibilité est connue est écarté des résultats.
 */
import type { Availability } from '../../shared/types.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { cached } from '../lib/cache.ts';

interface GmSlot {
  date: string;
  slots: number;
  types?: { price?: number; onlyMembers?: boolean }[];
}

const TTL = 10 * 60_000;
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

async function golfmanagerDay(host: string, date: string): Promise<GmSlot[]> {
  const { value } = await cached(
    `avail:gm:${host}:${date}`,
    async () => {
      const res = await fetch(`https://${host}/ebookings/searchAvailability.api?idResourceType=1&start=${date}`, {
        headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { availability?: GmSlot[] };
      return (data.availability ?? []).map((s) => ({ date: s.date, slots: s.slots, types: (s.types ?? []).map((t) => ({ price: t.price, onlyMembers: t.onlyMembers })) }));
    },
    TTL,
  );
  return value;
}

export interface AvailabilityQuery {
  ids: string[];
  date: string;
  from: string;
  to: string;
  players: number;
}

export async function availability(q: AvailabilityQuery): Promise<Record<string, Availability>> {
  const out: Record<string, Availability> = {};
  if (!q.ids.length) return out;
  const rows = await db.all<{ id: string; booking_url: string | null }>(
    `SELECT id, booking_url FROM golfs WHERE id IN (${q.ids.map(() => '?').join(',')})`,
    ...q.ids,
  );
  const urls = new Map(rows.map((r) => [r.id, r.booking_url]));
  // Un départ accueille 4 joueurs : au-delà, il faut plusieurs départs libres dans le créneau
  const perTee = Math.min(4, q.players);
  const teesNeeded = Math.ceil(q.players / 4);
  const a = minutes(q.from);
  const b = minutes(q.to);

  await Promise.all(
    q.ids.map(async (id) => {
      const raw = urls.get(id);
      let host: string | null = null;
      try {
        host = raw ? new URL(raw).hostname : null;
      } catch {
        host = null;
      }
      if (!host?.endsWith('.golfmanager.com')) {
        out[id] = { status: 'unknown', source: null };
        return;
      }
      try {
        const day = await golfmanagerDay(host, q.date);
        const fits = day.filter((s) => {
          // Heure locale du golf : « 2026-10-23T08:00:00+02:00 » → 08:00
          const local = s.date.slice(11, 16);
          const m = /^\d\d:\d\d$/.test(local) ? minutes(local) : -1;
          return m >= a && m < b && s.slots >= perTee && (s.types ?? []).some((x) => !x.onlyMembers);
        });
        const prices = fits.flatMap((s) => (s.types ?? []).filter((x) => !x.onlyMembers && typeof x.price === 'number').map((x) => x.price!));
        out[id] =
          fits.length >= teesNeeded
            ? { status: 'available', source: 'golfmanager', count: fits.length, first: fits[0].date.slice(11, 16), minPrice: prices.length ? Math.min(...prices) : null }
            : { status: 'full', source: 'golfmanager', count: fits.length };
      } catch {
        // Moteur injoignable : on ne sait pas, le golf reste proposé
        out[id] = { status: 'unknown', source: null };
      }
    }),
  );
  return out;
}
