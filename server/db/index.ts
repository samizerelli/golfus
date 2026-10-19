import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';
import { runMigrations } from './migrations.ts';

const memory = config.databasePath.endsWith(':memory:');
if (!memory) fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(memory ? ':memory:' : config.databasePath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Golfs complétés/corrigés localement. L'id reprend l'id OSM (osm-w123, osm-n123, osm-r123)
-- pour enrichir un golf OpenStreetMap, ou un id libre (demo-…, man-…) pour un golf saisi à la main.
CREATE TABLE IF NOT EXISTS golfs (
  id TEXT PRIMARY KEY,
  name TEXT,
  lat REAL,
  lon REAL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  holes INTEGER,
  par INTEGER,
  phone TEXT,
  email TEXT,
  website TEXT,
  booking_url TEXT,
  pricing_url TEXT,
  address TEXT,
  opening_hours TEXT,
  description TEXT NOT NULL DEFAULT '{}',
  photos TEXT NOT NULL DEFAULT '[]',
  courses TEXT NOT NULL DEFAULT '[]',
  services TEXT NOT NULL DEFAULT '{}',
  price_reliability TEXT NOT NULL DEFAULT 'unknown',
  price_updated_at TEXT,
  high_season_months TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  golf_id TEXT NOT NULL REFERENCES golfs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT 'all',
  day_type TEXT NOT NULL DEFAULT 'all',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT
);
CREATE INDEX IF NOT EXISTS prices_golf ON prices(golf_id);

-- Avis laissés par les visiteurs (aucune adresse IP ni identifiant n'est conservé)
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  golf_id TEXT NOT NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS reviews_golf ON reviews(golf_id);

-- Cache des réponses d'API externes
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
`);

runMigrations(db);
