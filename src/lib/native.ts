/**
 * Démarrage de l'app iOS (Capacitor). Sans effet dans un navigateur : le site n'est pas modifié.
 * - Jeton de connexion conservé dans le trousseau iOS (Keychain).
 * - Barre d'état assortie au thème clair / sombre.
 * - Sites externes (réservation, itinéraire, plateformes) ouverts dans Safari intégré, pas dans l'app.
 * - Notification touchée ou lien golfus.ch (Universal Link) : ouverture du bon écran.
 */
import { isNative, openInApp, PUBLIC_ORIGIN, tokenStore } from './platform';

const TOKEN_KEY = 'golfus.session';

export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('native-ios');

  const [{ SecureStorage }, { StatusBar, Style }, { Browser }, { App }, { PushNotifications }] = await Promise.all([
    import('@aparajita/capacitor-secure-storage'),
    import('@capacitor/status-bar'),
    import('@capacitor/browser'),
    import('@capacitor/app'),
    import('@capacitor/push-notifications'),
  ]);

  // Notification touchée : panneau « Mes parties » (ou celui indiqué par le serveur)
  void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const panel = (a.notification.data as { panel?: string } | undefined)?.panel;
    openInApp({ path: '/', panel: panel === 'friends' || panel === 'notifications' ? panel : 'outings' });
  });
  // Lien https://golfus.ch/… ouvert dans l'app (Universal Link) : même page que sur le site
  void App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      if (u.origin === PUBLIC_ORIGIN) openInApp({ path: u.pathname + u.search });
    } catch {
      /* adresse invalide */
    }
  });

  // Trousseau iOS : le jeton survit à la fermeture de l'app, chiffré par le système
  await tokenStore.init({
    get: async () => ((await SecureStorage.get(TOKEN_KEY)) as string | null) ?? null,
    set: (t) => SecureStorage.set(TOKEN_KEY, t),
    clear: async () => {
      await SecureStorage.remove(TOKEN_KEY);
    },
  });

  // Barre d'état : texte clair sur fond sombre (thème sombre, intro verte), texte foncé sinon
  const syncStatusBar = () => {
    const cl = document.documentElement.classList;
    return StatusBar.setStyle({ style: cl.contains('dark') || cl.contains('intro-open') ? Style.Dark : Style.Light }).catch(() => undefined);
  };
  void syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Liens externes http(s) : Safari intégré (SFSafariViewController) au lieu de quitter l'app ou de rester bloqué.
  // Les liens tel:, mailto:, sms: et WhatsApp sont laissés au système.
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol)) return;
      const internal = url.origin === location.origin || url.origin === PUBLIC_ORIGIN;
      if (internal && a.target !== '_blank') return;
      e.preventDefault();
      void Browser.open({ url: url.href });
    },
    true,
  );
}
