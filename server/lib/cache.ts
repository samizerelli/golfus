import { db } from '../db/index.ts';
import { config } from '../config.ts';

const getStmt = db.prepare('SELECT value, expires_at FROM api_cache WHERE key = ?');
const setStmt = db.prepare(
  'INSERT INTO api_cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
);

interface Entry<T> {
  value: T;
  fresh: boolean;
}

export function cacheGet<T>(key: string): Entry<T> | null {
  const row = getStmt.get(key) as { value: string; expires_at: number } | undefined;
  if (!row) return null;
  return { value: JSON.parse(row.value) as T, fresh: row.expires_at > Date.now() };
}

export function cacheSet(key: string, value: unknown, ttlMs = config.cacheTtlMs) {
  setStmt.run(key, JSON.stringify(value), Date.now() + ttlMs);
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Renvoie la valeur en cache si elle est fraîche, sinon appelle `fetcher`.
 * Si `fetcher` échoue et qu'une ancienne valeur existe, elle est renvoyée avec stale = true.
 * Les appels simultanés sur la même clé sont mutualisés.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = config.cacheTtlMs,
): Promise<{ value: T; stale: boolean }> {
  const hit = cacheGet<T>(key);
  if (hit?.fresh) return { value: hit.value, stale: false };

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetcher().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    const value = await p;
    cacheSet(key, value, ttlMs);
    return { value, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}

/** Purge des entrées expirées depuis plus de 30 jours */
export function pruneCache() {
  db.prepare('DELETE FROM api_cache WHERE expires_at < ?').run(Date.now() - 30 * 24 * 3600_000);
}
