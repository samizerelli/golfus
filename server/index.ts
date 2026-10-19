import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from './app.ts';
import { assertAdminConfigured, config } from './config.ts';
import { pruneCache } from './lib/cache.ts';

const dist = path.resolve('dist');
const app = createApp((a) => {
  // En production (serveur Node), le même processus sert aussi le site compilé
  if (config.isProd && fs.existsSync(dist)) {
    a.use(express.static(dist, { maxAge: '7d', index: false }));
    a.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
});

pruneCache();
app.listen(config.port, () => {
  console.log(`⛳ GolfUs API sur http://localhost:${config.port}`);
  if (!assertAdminConfigured()) console.warn('⚠️  ADMIN_PASSWORD / ADMIN_SESSION_SECRET non configurés : /admin désactivé.');
  if (!config.contactEmail) console.warn('ℹ️  CONTACT_EMAIL vide : renseignez-le avant une mise en ligne (conditions OSM).');
});
