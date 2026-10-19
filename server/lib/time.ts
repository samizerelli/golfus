/** Utilitaires de dates (fuseaux horaires, semaines ISO). Toutes les fonctions sont pures et testées. */

/** Décalage (minutes) d'un fuseau IANA à un instant donné. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Heure locale (minutes depuis minuit) dans un fuseau. */
export function localMinutes(tz: string, at: Date) {
  const local = new Date(at.getTime() + tzOffsetMinutes(tz, at) * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Prochain instant d'envoi autorisé en dehors des heures calmes [start, end) (fenêtre pouvant passer minuit).
 * Si l'instant courant est hors fenêtre, renvoie `at` tel quel.
 */
export function nextAllowedTime(at: Date, tz: string, quietStart: string, quietEnd: string): Date {
  const s = toMin(quietStart);
  const e = toMin(quietEnd);
  if (s === e) return at;
  const now = localMinutes(tz, at);
  const inQuiet = s < e ? now >= s && now < e : now >= s || now < e;
  if (!inQuiet) return at;
  const wait = (e - now + 1440) % 1440;
  const d = new Date(at.getTime() + wait * 60000);
  d.setUTCSeconds(0, 0);
  return d;
}

/** Semaine ISO 8601 d'une date AAAA-MM-JJ : « 2026-W43 ». */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // jeudi de la semaine
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Lundi (AAAA-MM-JJ) de la semaine ISO « AAAA-Www ». */
export function weekMonday(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
  return monday.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Semaine ISO précédente. */
export function prevWeek(week: string) {
  return isoWeek(addDays(weekMonday(week), -7));
}

/** Date locale du jour (AAAA-MM-JJ) dans un fuseau. */
export function localToday(tz: string, at = new Date()) {
  return new Date(at.getTime() + tzOffsetMinutes(tz, at) * 60000).toISOString().slice(0, 10);
}

/** Saison sportive = année civile (« 2026 »). */
export const seasonOf = (date: string) => date.slice(0, 4);
