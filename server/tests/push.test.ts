import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789';
const { createApp } = await import('../app.ts');
const { db } = await import('../db/index.ts');
const { pushText } = await import('../services/push.ts');
const { sendDayBeforeReminders, tomorrowIn } = await import('../services/reminders.ts');

let root = '';
let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  base = `${root}/api`;
});
after(() => server.close());

const APP = 'capacitor://localhost';
const json = { 'Content-Type': 'application/json', 'X-GF-CSRF': '1' };
const DEVICE = 'a'.repeat(64);

test('push : enregistrement de l’appareil réservé au compte connecté, jeton validé, suppression', async () => {
  await fetch(`${base}/account/register`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'push@example.com', password: 'Birdie2026', name: 'Paul', lang: 'fr', terms: true }) });
  const { token } = (await (await fetch(`${base}/mobile/login`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ email: 'push@example.com', password: 'Birdie2026' }) })).json()) as { token: string };
  const auth = { ...json, Origin: APP, Authorization: `Bearer ${token}` };

  const anon = await fetch(`${base}/push/devices`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ token: DEVICE }) });
  assert.equal(anon.status, 401);
  const bad = await fetch(`${base}/push/devices`, { method: 'POST', headers: auth, body: JSON.stringify({ token: 'pas-un-jeton' }) });
  assert.equal(bad.status, 400);
  const ok = await fetch(`${base}/push/devices`, { method: 'POST', headers: auth, body: JSON.stringify({ token: DEVICE.toUpperCase(), lang: 'es' }) });
  assert.equal(ok.status, 201);
  assert.deepEqual(await db.get('SELECT lang FROM push_devices WHERE token = ?', DEVICE), { lang: 'es' });

  assert.equal((await fetch(`${base}/push/devices/${DEVICE}`, { method: 'DELETE', headers: auth })).status, 200);
  assert.equal(await db.get('SELECT 1 FROM push_devices WHERE token = ?', DEVICE), undefined);
});

test('push : textes dans la langue de l’appareil', () => {
  assert.equal(pushText('outing_invite', 'fr', { from: 'Léa', golf: 'La Cala', date: '2026-10-23' }), 'Léa vous invite au La Cala le 23 octobre');
  assert.equal(pushText('outing_response', 'en', { from: 'Tom', golf: 'La Cala', response: 'maybe' }), 'Tom answered “Maybe” for La Cala');
  assert.equal(pushText('outing_reminder', 'es', { golf: 'La Cala', timeFrom: '09:30' }), 'Mañana: tu partida en La Cala a las 09:30');
});

test('Universal Links : pas de fichier d’association sans identifiant d’équipe Apple', async () => {
  assert.equal((await fetch(`${root}/.well-known/apple-app-site-association`)).status, 404);
});

test('rappel la veille : organisateur et invités partants, une seule fois', async () => {
  const now = new Date('2026-10-22T16:00:00Z');
  const date = tomorrowIn('Europe/Madrid', now);
  assert.equal(date, '2026-10-23');
  for (const id of ['u-org', 'u-yes', 'u-no']) await db.run('INSERT INTO users (id, email, name) VALUES (?, ?, ?)', id, `${id}@example.com`, id);
  await db.run(
    "INSERT INTO outings (id, organizer_id, golf_id, golf_name, date, time_from, time_to, players, share_token) VALUES ('o1', 'u-org', 'g', 'La Cala', ?, '09:30', '12:00', 3, 'tok-o1')",
    date,
  );
  await db.run("INSERT INTO outing_guests (id, outing_id, user_id, response) VALUES ('g1', 'o1', 'u-yes', 'yes'), ('g2', 'o1', 'u-no', 'no')");

  const first = await sendDayBeforeReminders(now);
  assert.equal(first.sent, 2);
  const rows = await db.all<{ user_id: string }>("SELECT user_id FROM notifications WHERE type = 'outing_reminder' ORDER BY user_id");
  assert.deepEqual(rows.map((r) => r.user_id), ['u-org', 'u-yes']);
  assert.equal((await sendDayBeforeReminders(now)).sent, 0, 'pas de second rappel');
});
