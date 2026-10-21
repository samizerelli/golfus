import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App iOS GolfUs (Capacitor). L'interface est celle du site, construite par `npm run build:ios` dans dist-ios
 * et embarquée dans l'app ; les données viennent de https://golfus.ch (voir .env.ios).
 */
const config: CapacitorConfig = {
  appId: 'ch.golfus.app',
  appName: 'GolfUs',
  webDir: 'dist-ios',
  ios: {
    // Les zones sûres (encoche, barre d'accueil) sont gérées en CSS avec env(safe-area-inset-*)
    contentInset: 'never',
    backgroundColor: '#0e2a20',
    // Défilement élastique désactivé sur la page entière : seuls les panneaux défilent, comme sur le site
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0e2a20',
      showSpinner: false,
    },
    Keyboard: {
      // Le contenu se redimensionne au-dessus du clavier (champs de recherche, messages)
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: true,
    },
  },
};

export default config;
