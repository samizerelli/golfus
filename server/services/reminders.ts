/**
 * Rappel la veille d'une partie : notification (dans l'app et push) à l'organisateur et aux invités
 * qui ont répondu « Partant » ou « Peut-être ». Lancé une fois par jour (netlify/functions/reminders.mts).
 * Chaque partie n'est rappelée qu'une fois, même si la tâche tourne plusieurs fois.
 */
import { db } from '../db/index.ts';
import { notify } from '../routes/social.ts';

/** Date du lendemain (AAAA-MM-JJ) dans le fuseau des golfs proposés (Espagne / Suisse : même heure) */
export function tomorrowIn(timeZone: string, now = new Date()) {
  return new Date(now.getTime() + 24 * 3600_000).toLocaleDateString('en-CA', { timeZone });
}

export async function sendDayBeforeReminders(now = new Date()) {
  const date = tomorrowIn('Europe/Madrid', now);
  const outings = await db.all<{ id: string; organizer_id: string; golf_name: string; date: string; time_from: string }>(
    "SELECT id, organizer_id, golf_name, date, time_from FROM outings WHERE status = 'active' AND date = ? AND reminded_at IS NULL",
    date,
  );
  let sent = 0;
  for (const o of outings) {
    // Réservation atomique du rappel : une seule exécution l'envoie
    const claimed = await db.get<{ id: string }>('UPDATE outings SET reminded_at = now() WHERE id = ? AND reminded_at IS NULL RETURNING id', o.id);
    if (!claimed) continue;
    const guests = await db.all<{ user_id: string }>(
      "SELECT user_id FROM outing_guests WHERE outing_id = ? AND user_id IS NOT NULL AND response IN ('yes','maybe')",
      o.id,
    );
    const payload = { outingId: o.id, golf: o.golf_name, date: o.date, timeFrom: o.time_from };
    for (const uid of new Set([o.organizer_id, ...guests.map((g) => g.user_id)])) {
      await notify(uid, 'outing_reminder', payload);
      sent++;
    }
  }
  return { date, outings: outings.length, sent };
}
