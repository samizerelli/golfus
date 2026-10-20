import { Component, type ReactNode } from 'react';

const RELOADED = 'gf.chunkReload';
const STALE = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i;

/** Rechargement unique quand un fichier de l'ancienne version n'existe plus (onglet ouvert avant une mise en ligne). */
export function reloadOnceForStaleAssets() {
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** À appeler au démarrage : surveille les fichiers manquants et réarme le rechargement une fois l'app chargée. */
export function watchStaleAssets() {
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnceForStaleAssets()) e.preventDefault();
  });
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOADED);
    } catch {
      /* rien */
    }
  }, 10_000);
}

/**
 * Filet de sécurité : une erreur d'affichage montre un écran de secours au lieu d'une page blanche.
 * Après une mise en ligne, un ancien onglet peut réclamer un fichier qui n'existe plus : on recharge alors une fois.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (STALE.test(error?.message ?? '')) reloadOnceForStaleAssets();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const fr = navigator.language.startsWith('fr');
    const es = navigator.language.startsWith('es');
    return (
      <div className="intro flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-white">
        <p className="text-2xl font-semibold">{fr ? 'Oups, un souci d’affichage.' : es ? 'Vaya, algo ha fallado.' : 'Oops, something went wrong.'}</p>
        <p className="max-w-sm text-white/80">{fr ? 'Rechargez la page pour reprendre.' : es ? 'Recarga la página para continuar.' : 'Reload the page to continue.'}</p>
        <button type="button" onClick={() => window.location.assign('/')} className="h-12 rounded-full bg-white px-6 font-semibold text-fairway-900">
          {fr ? 'Recharger' : es ? 'Recargar' : 'Reload'}
        </button>
      </div>
    );
  }
}

/**
 * Filet local (ex. la carte) : en cas d'erreur, seule cette zone disparaît, le reste de l'app reste utilisable.
 * Nouvel essai automatique quand `resetKey` change (changement d'écran).
 */
export class SectionBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean; key?: string }> {
  state: { failed: boolean; key?: string } = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: { failed: boolean; key?: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error('[section]', error);
    if (STALE.test(error?.message ?? '')) reloadOnceForStaleAssets();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
