import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationEmail } from '../services/notifyEmail.ts';

test('e-mail de demande d’ami, dans la langue du joueur', () => {
  const fr = notificationEmail('friend_request', 'fr', { name: 'Sami' });
  assert.equal(fr.subject, 'Sami vous demande en ami sur GolfUs');
  assert.match(fr.text, /menu Amis/);
  const en = notificationEmail('friend_request', 'en', { name: 'Sami' });
  assert.equal(en.subject, 'Sami wants to be your friend on GolfUs');
});

test('e-mail d’invitation : golf et date, texte échappé dans le HTML', () => {
  const m = notificationEmail('outing_invite', 'es', { from: 'Sami <b>', golf: 'La Cala', date: '2026-11-14', timeFrom: '09:00' });
  assert.equal(m.subject, 'Sami <b> te invita a jugar al golf');
  assert.match(m.text, /La Cala/);
  assert.match(m.text, /14 de noviembre/);
  assert.ok(!m.html.includes('<b>'));
  // Langue inconnue : français
  assert.match(notificationEmail('outing_invite', 'de', { from: 'A', golf: 'G', date: '2026-11-14' }).subject, /vous invite/);
});
