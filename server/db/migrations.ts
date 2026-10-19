import type { DatabaseSync } from 'node:sqlite';

/**
 * Migrations numérotées. Ne jamais modifier une migration déjà publiée : en ajouter une nouvelle.
 * Voir docs/SCHEMA.md pour la description complète.
 */
export const migrations: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'comptes, amis, parties organisées, notifications, réservations, commentaires, scores',
    sql: `
-- ───── Comptes (Auth.js : lien magique, Google, Apple) ─────
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  email_verified TEXT,
  name TEXT,
  username TEXT UNIQUE COLLATE NOCASE,
  image TEXT,
  handicap_index REAL,
  lang TEXT NOT NULL DEFAULT 'fr',
  invite_code TEXT UNIQUE,
  hide_from_leaderboard INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  session_version INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at TEXT,
  push_consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT, access_token TEXT, expires_at INTEGER, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
  PRIMARY KEY (provider, provider_account_id)
);
CREATE INDEX accounts_user ON accounts(user_id);
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ───── Amis ─────
CREATE TABLE friendships (
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX friendships_b ON friendships(user_b);

-- ───── Parties organisées ─────
CREATE TABLE outings (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  golf_id TEXT NOT NULL,
  golf_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  players INTEGER NOT NULL,
  message TEXT,
  share_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX outings_date ON outings(date);
-- Invités : un ami de l'app (user_id) ou une personne extérieure venue par le lien (guest_name)
CREATE TABLE outing_guests (
  id TEXT PRIMARY KEY,
  outing_id TEXT NOT NULL REFERENCES outings(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_token TEXT UNIQUE,
  response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending','yes','maybe','no')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (outing_id, user_id)
);
CREATE INDEX outing_guests_user ON outing_guests(user_id);

-- ───── Notifications ─────
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  pushed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX notifications_user ON notifications(user_id, id);
CREATE INDEX notifications_push ON notifications(pushed_at);
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX push_user ON push_subscriptions(user_id);

-- ───── Réservations (jamais « confirmée » sans le golf ou l'utilisateur) ─────
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  golf_id TEXT NOT NULL,
  golf_name TEXT NOT NULL,
  date TEXT,
  time TEXT,
  players INTEGER,
  channel TEXT NOT NULL CHECK (channel IN ('online','request')),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','confirmed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX bookings_user ON bookings(user_id, status);

-- ───── Commentaires (un avis par personne et par golf) ─────
CREATE TABLE golf_comments (
  id TEXT PRIMARY KEY,
  golf_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (golf_id, user_id)
);
CREATE INDEX golf_comments_golf ON golf_comments(golf_id, created_at);
CREATE TABLE comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL REFERENCES golf_comments(id) ON DELETE CASCADE,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (comment_id, reporter_id)
);
CREATE INDEX comment_reports_status ON comment_reports(status);

-- ───── Scores (privés par défaut) ─────
CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  golf_id TEXT NOT NULL,
  golf_name TEXT NOT NULL,
  played_on TEXT NOT NULL,
  holes INTEGER NOT NULL CHECK (holes IN (9,18)),
  score INTEGER NOT NULL CHECK (score BETWEEN 18 AND 250),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX rounds_user ON rounds(user_id, played_on);
CREATE INDEX rounds_golf ON rounds(user_id, golf_id);
CREATE TABLE round_friends (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, user_id)
);

-- Boîte d'envoi des e-mails en développement (sans serveur SMTP)
CREATE TABLE dev_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
`,
  },
];

export function runMigrations(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))`);
  const done = new Set((db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map((r) => r.id));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(m.id, m.name);
      db.exec('COMMIT');
      console.log(`🗄️  Migration ${m.id} appliquée : ${m.name}`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${m.id} échouée : ${(e as Error).message}`);
    }
  }
}
