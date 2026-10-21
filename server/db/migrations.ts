/**
 * Migrations Postgres numérotées (Netlify Database en ligne, PGlite en local).
 * Ne jamais modifier une migration déjà déployée : en ajouter une nouvelle.
 */
export const migrations: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'golfs, tarifs, avis, cache',
    sql: `
CREATE TABLE golfs (
  id TEXT PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX golfs_manual_geo ON golfs (lat, lon) WHERE id NOT LIKE 'osm-%';

CREATE TABLE prices (
  id SERIAL PRIMARY KEY,
  golf_id TEXT NOT NULL REFERENCES golfs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT 'all',
  day_type TEXT NOT NULL DEFAULT 'all',
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT
);
CREATE INDEX prices_golf ON prices(golf_id);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  golf_id TEXT NOT NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_golf ON reviews(golf_id);

CREATE TABLE api_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
`,
  },
  {
    id: 2,
    name: 'comptes utilisateurs (Auth.js)',
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  name TEXT,
  image TEXT,
  password_hash TEXT,
  handicap_index DOUBLE PRECISION,
  lang TEXT NOT NULL DEFAULT 'fr',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  session_version INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT, access_token TEXT, expires_at BIGINT, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
  PRIMARY KEY (provider, provider_account_id)
);
CREATE INDEX accounts_user ON accounts(user_id);
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
-- E-mails capturés en développement (sans serveur SMTP)
CREATE TABLE dev_outbox (
  id SERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  },
  {
    id: 3,
    name: 'amis, invitations à jouer, notifications',
    sql: `
CREATE TABLE friendships (
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  requested_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX friendships_b ON friendships(user_b);

CREATE TABLE outings (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  golf_id TEXT NOT NULL,
  golf_name TEXT NOT NULL,
  golf_lat DOUBLE PRECISION,
  golf_lon DOUBLE PRECISION,
  date TEXT NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  holes INTEGER,
  players INTEGER NOT NULL,
  message TEXT,
  share_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outings_organizer ON outings(organizer_id, date);

CREATE TABLE outing_guests (
  id TEXT PRIMARY KEY,
  outing_id TEXT NOT NULL REFERENCES outings(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_token TEXT UNIQUE,
  response TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending','yes','maybe','no')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (outing_id, user_id)
);
CREATE INDEX outing_guests_user ON outing_guests(user_id);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications(user_id, id);
`,
  },
  {
    id: 4,
    name: 'propositions extraites des sites officiels des golfs',
    sql: `
CREATE TABLE site_extractions (
  id SERIAL PRIMARY KEY,
  golf_id TEXT NOT NULL,
  golf_name TEXT,
  site TEXT NOT NULL,
  data TEXT NOT NULL,
  price_count INTEGER NOT NULL DEFAULT 0,
  suggested_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX site_extractions_golf ON site_extractions(golf_id, created_at);
CREATE INDEX site_extractions_status ON site_extractions(status);
`,
  },
  {
    id: 5,
    name: 'tarifs par tranche horaire (twilight, early bird) : heure de début et de fin',
    sql: `
ALTER TABLE prices ADD COLUMN from_time TEXT;
ALTER TABLE prices ADD COLUMN to_time TEXT;
`,
  },
  {
    id: 6,
    name: 'tarifs par période de dates (saisons datées : JJ/MM au JJ/MM)',
    sql: `
ALTER TABLE prices ADD COLUMN IF NOT EXISTS from_date TEXT;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS to_date TEXT;
`,
  },
  {
    id: 7,
    name: 'offres des plateformes de réservation (comparatif des green fees)',
    sql: `
ALTER TABLE golfs ADD COLUMN IF NOT EXISTS offers TEXT NOT NULL DEFAULT '[]';
`,
  },
];

interface MigDriver {
  withClient<T>(fn: (q: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>): Promise<T>;
}

/** Applique les migrations manquantes, sous verrou consultatif (plusieurs fonctions peuvent démarrer en même temps). */
/**
 * Applique les migrations manquantes. Plusieurs instances peuvent démarrer en même temps (fonctions Netlify) :
 * chaque migration se fait dans une transaction protégée par un verrou de transaction (compatible avec les
 * pools de connexions en mode transaction), avec une nouvelle vérification une fois le verrou obtenu.
 */
export async function runMigrations(d: MigDriver) {
  await d.withClient(async (q) => {
    await q('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())', []);
    const done = new Set((await q('SELECT id FROM schema_migrations', [])).rows.map((r) => Number(r.id)));
    for (const m of migrations) {
      if (done.has(m.id)) continue;
      await q('BEGIN', []);
      try {
        await q('SELECT pg_advisory_xact_lock(727401)', []);
        // Une autre instance l'a peut-être appliquée pendant l'attente du verrou
        const already = (await q('SELECT 1 FROM schema_migrations WHERE id = $1', [m.id])).rows.length > 0;
        if (!already) {
          for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) await q(stmt, []);
          await q('INSERT INTO schema_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [m.id, m.name]);
        }
        await q('COMMIT', []);
        if (!already) console.log(`🗄️  Migration ${m.id} appliquée : ${m.name}`);
      } catch (e) {
        await q('ROLLBACK', []);
        throw new Error(`Migration ${m.id} échouée : ${(e as Error).message}`);
      }
    }
  });
}
