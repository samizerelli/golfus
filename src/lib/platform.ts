/**
 * Web ou app iOS (Capacitor) : le même code sert les deux.
 * - isNative() : vrai dans l'app installée (WKWebView Capacitor), faux dans un navigateur.
 * - PUBLIC_ORIGIN : adresse publique du site, pour les liens partagés (invitations, fiches). Dans l'app,
 *   location.origin vaut « capacitor://localhost » : il ne faut jamais l'utiliser dans un lien envoyé à quelqu'un.
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export function isNative() {
  return !!(globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.();
}

export const PUBLIC_ORIGIN = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') || (isNative() ? 'https://golfus.ch' : location.origin);

/**
 * Jeton de connexion de l'app (inutile sur le web, qui garde la session par cookie).
 * Le stockage durable est branché au démarrage de l'app native (trousseau iOS, voir native.ts) ;
 * sans lui, le jeton reste en mémoire seulement.
 */
export interface TokenBackend {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

let backend: TokenBackend | null = null;
let cached: string | null = null;

export const tokenStore = {
  async init(b: TokenBackend) {
    backend = b;
    cached = await b.get().catch(() => null);
  },
  get: () => cached,
  async set(token: string) {
    cached = token;
    await backend?.set(token);
  },
  async clear() {
    cached = null;
    await backend?.clear();
  },
};
