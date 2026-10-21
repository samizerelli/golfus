/**
 * Accès à la base Postgres.
 * - En ligne (Netlify) : Netlify Database (Postgres managé), via la variable NETLIFY_DB_URL fournie par Netlify.
 * - En local et dans les tests : PGlite (Postgres complet embarqué, sans installation), stocké dans data/pglite
 *   ou en mémoire si DATABASE_PATH=":memory:".
 * Les requêtes s'écrivent avec des « ? » (convertis en $1, $2…) pour rester lisibles.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migrations.ts';

type Row = Record<string, unknown>;
type Query = (sql: string, params: unknown[]) => Promise<{ rows: Row[]; rowCount: number }>;
interface Driver {
  query: Query;
  exec(sql: string): Promise<void>;
  /** Exécute fn sur une connexion dédiée (transaction) */
  withClient<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

/** Connexion de la transaction en cours (les requêtes faites dans db.tx l'utilisent automatiquement) */
const txContext = new AsyncLocalStorage<Query>();

/** Convertit les « ? » en $1, $2… (en ignorant ceux situés dans des chaînes entre apostrophes). */
export function toPg(sql: string) {
  let n = 0;
  let inStr = false;
  let out = '';
  for (const c of sql) {
    if (c === "'") inStr = !inStr;
    out += c === '?' && !inStr ? `$${++n}` : c;
  }
  return out;
}

async function createDriver(): Promise<Driver> {
  if (process.env.NETLIFY_DB_URL) {
    const { getDatabase } = await import('@netlify/database');
    type PgLike = { query: (s: string, p?: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }> };
    const pool = getDatabase().pool as unknown as PgLike & { connect: () => Promise<PgLike & { release: () => void }> };
    const wrap = (c: PgLike): Query => async (sql, params) => {
      const r = await c.query(sql, params);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    };
    return {
      query: wrap(pool),
      async exec(sql) {
        await pool.query(sql);
      },
      async withClient(fn) {
        const client = await pool.connect();
        try {
          return await fn(wrap(client));
        } finally {
          client.release();
        }
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const target = process.env.DATABASE_PATH === ':memory:' ? undefined : path.resolve(process.env.DATABASE_DIR || './data/pglite');
  if (target) fs.mkdirSync(target, { recursive: true });
  const pg = new PGlite(target);
  const query: Query = async (sql, params) => {
    const r = await pg.query<Row>(sql, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  // PGlite n'a qu'une connexion : on sérialise les transactions
  let chain: Promise<unknown> = Promise.resolve();
  return {
    query,
    async exec(sql) {
      await pg.exec(sql);
    },
    withClient(fn) {
      const run = chain.then(() => fn(query));
      chain = run.catch(() => undefined);
      return run;
    },
  };
}

let ready: Promise<Driver> | null = null;
function driver() {
  ready ??= (async () => {
    const d = await createDriver();
    await runMigrations(d);
    return d;
  })().catch((e) => {
    // Échec (base momentanément indisponible…) : nouvel essai à la requête suivante
    ready = null;
    throw e;
  });
  return ready;
}

async function q(sql: string, params: unknown[]) {
  const inTx = txContext.getStore();
  return inTx ? inTx(toPg(sql), params) : (await driver()).query(toPg(sql), params);
}

export const db = {
  /** Toutes les lignes */
  async all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await q(sql, params)).rows as T[];
  },
  /** Première ligne ou undefined */
  async get<T = Row>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return (await q(sql, params)).rows[0] as T | undefined;
  },
  /** Écriture : renvoie le nombre de lignes modifiées */
  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    return { changes: (await q(sql, params)).rowCount };
  },
  async exec(sql: string) {
    await (await driver()).exec(sql);
  },
  /** Transaction sur une connexion dédiée : toutes les requêtes faites dans fn y participent. */
  async tx<T>(fn: () => Promise<T>): Promise<T> {
    const d = await driver();
    return d.withClient(async (query) => {
      await query('BEGIN', []);
      try {
        const r = await txContext.run(query, fn);
        await query('COMMIT', []);
        return r;
      } catch (e) {
        await query('ROLLBACK', []);
        throw e;
      }
    });
  },
  ready: () => driver().then(() => undefined),
};
