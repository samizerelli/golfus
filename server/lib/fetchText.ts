import { config } from '../config.ts';

/**
 * Télécharge une page texte/HTML avec limites strictes (durée, taille, type) et un User-Agent identifiable.
 * Refuse les adresses locales / privées (pas d'accès au réseau interne via une URL saisie).
 */
export async function fetchText(url: string, opts: { timeoutMs?: number; maxBytes?: number; acceptAny?: boolean } = {}) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocole refusé');
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?|0\.)/i.test(u.hostname)) throw new Error('adresse locale refusée');
  const res = await fetch(u, {
    headers: { 'User-Agent': config.userAgent, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!opts.acceptAny && !/text\/html|application\/xhtml/.test(type)) throw new Error('pas une page HTML');
  const max = opts.maxBytes ?? 1_500_000;
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { body: new TextDecoder('utf-8').decode(Buffer.concat(chunks)), finalUrl: res.url };
}
