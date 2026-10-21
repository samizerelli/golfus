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

test('app iOS : connexion par jeton, CORS limité, révocation, site tiers refusé', async () => {
  // Compte créé comme sur le site
  const reg = await fetch(`${base}/account/register`, { method: 'POST', headers: json, body: JSON.stringify({ email: 'ios@example.com', password: 'Birdie2026', name: 'Iris', lang: 'fr', terms: true }) });
  assert.equal(reg.status, 201);

  // Pré-vol CORS depuis l'app : autorisé ; depuis un autre site : aucune autorisation
  const pre = await fetch(`${base}/mobile/login`, { method: 'OPTIONS', headers: { Origin: APP, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), APP);
  const preEvil = await fetch(`${base}/mobile/login`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(preEvil.headers.get('access-control-allow-origin'), null);

  // Mauvais mot de passe puis bon mot de passe
  const bad = await fetch(`${base}/mobile/login`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ email: 'ios@example.com', password: 'faux' }) });
  assert.equal(bad.status, 401);
  const ok = await fetch(`${base}/mobile/login`, { method: 'POST', headers: { ...json, Origin: APP }, body: JSON.stringify({ email: 'IOS@example.com', password: 'Birdie2026' }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('set-cookie'), null, 'aucun cookie pour l’app');
  const { token } = (await ok.json()) as { token: string };
  const auth = { ...json, Origin: APP, Authorization: `Bearer ${token}` };

  // Lecture et écriture authentifiées depuis l'app
  const me = (await (await fetch(`${base}/me`, { headers: auth })).json()) as { user: { email: string } | null };
  assert.equal(me.user?.email, 'ios@example.com');
  assert.equal((await fetch(`${base}/notifications/read`, { method: 'POST', headers: auth })).status, 200);

  // Jeton falsifié : non connecté
  const forged = await fetch(`${base}/friends`, { headers: { ...auth, Authorization: `Bearer ${token.slice(0, -2)}xx` } });
  assert.equal(forged.status, 401);

  // Un site tiers ne peut pas écrire avec des cookies (contrôle d'origine conservé)
  const evil = await fetch(`${base}/notifications/read`, { method: 'POST', headers: { ...json, Origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);

  // « Se déconnecter partout » (version de session) : le jeton de l'app ne vaut plus rien
  await db.run("UPDATE users SET session_version = session_version + 1 WHERE email = 'ios@example.com'");
  const revoked = (await (await fetch(`${base}/me`, { headers: auth })).json()) as { user: unknown };
  assert.equal(revoked.user, null);
});
