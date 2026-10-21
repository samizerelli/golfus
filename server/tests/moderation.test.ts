import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789';
const { createApp } = await import('../app.ts');
const { db } = await import('../db/index.ts');
const { isObjectionable } = await import('../lib/moderation.ts');

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
  const id = (await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', email))!.id;
  return { id, h: { ...json, Origin: APP, Authorization: `Bearer ${token}` } };
}

test('filtre : insultes refusées, textes normaux acceptés', async () => {
  assert.equal(isObjectionable('Parcours superbe, un peu en retard au départ'), false);
  assert.equal(isObjectionable('spicy tapas au club house'), false);
  assert.equal(isObjectionable('quel c0nn4rd'), true);
  const bad = await fetch(`${base}/golfs/demo-test/reviews`, { method: 'POST', headers: json, body: JSON.stringify({ author: 'X', rating: 1, comment: 'Fucking awful' }) });
  assert.deepEqual([bad.status, ((await bad.json()) as { error: string }).error], [400, 'inappropriate']);
  const link = await fetch(`${base}/golfs/demo-test/reviews`, { method: 'POST', headers: json, body: JSON.stringify({ author: 'X', rating: 5, comment: 'Promo sur www.spam-golf.xyz' }) });
  assert.equal(link.status, 400);
  const name = await fetch(`${base}/account/register`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'n@example.com', password: 'Birdie2026', name: 'Salope', lang: 'fr', terms: true }) });
  assert.equal(((await name.json()) as { error: string }).error, 'inappropriate');
});

test('signalement : un avis signalé 3 fois est masqué ; l’administrateur peut le rétablir', async () => {
  const r = await fetch(`${base}/golfs/demo-test/reviews`, { method: 'POST', headers: json, body: JSON.stringify({ author: 'Alex', rating: 4, comment: 'Beau parcours' }) });
  const { id } = (await r.json()) as { id: number };
  for (let i = 0; i < 3; i++) {
    const rep = await fetch(`${base}/reports`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'review', targetId: String(id), reason: 'offensive' }) });
    assert.equal(rep.status, 201);
  }
  assert.ok((await db.get<{ hidden_at: unknown }>('SELECT hidden_at FROM reviews WHERE id = ?', id))?.hidden_at);
  // Signaler un joueur exige un compte
  const anon = await fetch(`${base}/reports`, { method: 'POST', headers: json, body: JSON.stringify({ kind: 'user', targetId: 'x', reason: 'harassment' }) });
  assert.equal(anon.status, 401);
});

test('blocage : amitié retirée, demandes ignorées, invisible dans la recherche', async () => {
  const a = await account('bloqueur@example.com', 'Bernard');
  const b = await account('importun@example.com', 'Ivan');
  await fetch(`${base}/friends/request`, { method: 'POST', headers: a.h, body: JSON.stringify({ userId: b.id }) });
  await fetch(`${base}/friends/${a.id}/accept`, { method: 'POST', headers: b.h });
  assert.equal(((await (await fetch(`${base}/friends`, { headers: a.h })).json()) as { friends: unknown[] }).friends.length, 1);

  assert.equal((await fetch(`${base}/blocks`, { method: 'POST', headers: a.h, body: JSON.stringify({ userId: b.id }) })).status, 201);
  assert.equal(((await (await fetch(`${base}/friends`, { headers: a.h })).json()) as { friends: unknown[] }).friends.length, 0);
  // Nouvelle demande de la personne bloquée : rien n'est créé
  await fetch(`${base}/friends/request`, { method: 'POST', headers: b.h, body: JSON.stringify({ userId: a.id }) });
  assert.equal(((await (await fetch(`${base}/friends`, { headers: a.h })).json()) as { incoming: unknown[] }).incoming.length, 0);
  // Ni l'un ni l'autre ne se trouve dans la recherche
  assert.deepEqual(await (await fetch(`${base}/users/search?q=Ber`, { headers: b.h })).json(), []);
  assert.deepEqual(await (await fetch(`${base}/users/search?q=Iva`, { headers: a.h })).json(), []);
  // Débloquer
  await fetch(`${base}/blocks/${b.id}`, { method: 'DELETE', headers: a.h });
  assert.equal(((await (await fetch(`${base}/users/search?q=Iva`, { headers: a.h })).json()) as unknown[]).length, 1);
});

test('app : export des données par lien temporaire ; connexion Apple refusée sans jeton Apple valide', async () => {
  const u = await account('export@example.com', 'Elsa');
  const { url } = (await (await fetch(`${base}/me/export-link`, { method: 'POST', headers: u.h })).json()) as { url: string };
  const t = new URL(url).searchParams.get('t')!;
  const ok = await fetch(`${base}/me/export?t=${encodeURIComponent(t)}`);
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as { account: { email: string } }).account.email, 'export@example.com');
  assert.equal((await fetch(`${base}/me/export?t=faux`)).status, 401);
  // Jeton de l'app (autre usage) refusé comme lien d'export
  assert.equal((await fetch(`${base}/me/export?t=${u.h.Authorization.slice(7)}`)).status, 401);

  const apple = await fetch(`${base}/mobile/apple`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ identityToken: 'x'.repeat(40), nonce: 'n'.repeat(32) }) });
  assert.equal(apple.status, 401);
});

test('aide et contact : message enregistré, champs validés', async () => {
  const ok = await fetch(`${base}/contact`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'Golfeur@Example.com', topic: 'bug', message: 'Le prix de La Cala est faux.' }) });
  assert.equal(ok.status, 201);
  assert.deepEqual(await db.get("SELECT email, topic FROM contact_messages WHERE message LIKE 'Le prix%'"), { email: 'golfeur@example.com', topic: 'bug' });
  const bad = await fetch(`${base}/contact`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'pas-un-email', topic: 'bug', message: 'Bonjour' }) });
  assert.equal(bad.status, 400);
});
