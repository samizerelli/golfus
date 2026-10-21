/**
 * Tâche planifiée Netlify : rappel la veille des parties (voir server/services/reminders.ts).
 * 16:00 UTC = 18:00 en été, 17:00 en hiver (heure d'Espagne et de Suisse).
 */
export default async () => {
  process.env.NODE_ENV ??= 'production';
  const { sendDayBeforeReminders } = await import('../../server/services/reminders.ts');
  const r = await sendDayBeforeReminders();
  console.log(`[rappels] ${r.date} : ${r.outings} partie(s), ${r.sent} notification(s)`);
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '0 16 * * *' };
