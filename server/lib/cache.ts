import { config } from '../config.ts';
import { db } from '../db/index.ts';

interface Entry<T> {
  value: T;
  fresh: boolean;
}

export async function cacheGet<T>(key: string): Promise<Entry<T> | null> {
  const row = await db.get<{ value: string; expires_at: string }>('SELECT value, expires_at FROM api_cache WHERE key = ?', key);
  if (!row) return null;
  return { value: JSON.parse(row.value) as T, fresh: Number(row.expires_at) > Date.now() };
}

export async function cacheSet(key: string, value: unknown, ttlMs = config.cacheTtlMs) {
  await db.run(
    'INSERT INTO api_cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
    key,
    JSON.stringify(value),
    Date.now() + ttlMs,
  );
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Renvoie la valeur en cache si elle est fraîche, sinon appelle `fetcher`.
 * Si `fetcher` échoue et qu'une ancienne valeur existe, elle est renvoyée avec stale = true.
 * Les appels simultanés sur la même clé sont mutualisés.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = config.cacheTtlMs): Promise<{ value: T; stale: boolean }> {
  const hit = await cacheGet<T>(key);
  if (hit?.fresh) return { value: hit.value, stale: false };

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fetcher().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    const value = await p;
    await cacheSet(key, value, ttlMs);
    return { value, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}

/** Purge des entrées expirées depuis plus de 30 jours */
export async function pruneCache() {
  await db.run('DELETE FROM api_cache WHERE expires_at < ?', Date.now() - 30 * 24 * 3600_000);
}
