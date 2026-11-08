import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789';
const { createApp } = await import('../app.ts');
const { db } = await import('../db/index.ts');

let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

const APP = 'capacitor://localhost';
const json = { 'Content-Type': 'application/json', 'X-GF-CSRF': '1' };

async function account(email: string, name: string) {
  await fetch(`${base}/account/register`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'Birdie2026', name, lang: 'fr', terms: true }) });
  const { token } = (await (await fetch(`${base}/mobile/login`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ email, password: 'Birdie2026' }) })).json()) as { token: string };
  return { ...json, Origin: APP, Authorization: `Bearer ${token}` };
}

test('invitation : un contact avec un compte GolfUs (même sans être ami) est invité et prévenu dans l’app', async () => {
  const org = await account('org@example.com', 'Sami');
  await account('hayat@example.com', 'Hayat');
  const r = await fetch(`${base}/outings`, {
    method: 'POST',
    headers: org,
    body: JSON.stringify({
      golfId: 'demo-la-cala', golfName: 'La Cala', golfLat: null, golfLon: null, date: '2030-05-02', timeFrom: '09:00', timeTo: '11:00',
      holes: 18, players: 2, message: null, friendIds: [], emails: ['Hayat@Example.com', 'inconnu@example.com'],
    }),
  });
  assert.equal(r.status, 201);
  const o = (await r.json()) as { matchedEmails: string[]; guests: { name: string }[]; shareToken: string };
  assert.deepEqual(o.matchedEmails, ['hayat@example.com']);
  assert.deepEqual(o.guests.map((g) => g.name), ['Hayat']);
  assert.ok(o.shareToken);
  const n = await db.get<{ type: string }>("SELECT n.type FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = 'hayat@example.com'");
  assert.equal(n?.type, 'outing_invite');
});
