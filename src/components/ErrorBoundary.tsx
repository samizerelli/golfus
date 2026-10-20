import { Component, type ReactNode } from 'react';

const RELOADED = 'gf.chunkReload';

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
    const staleChunk = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(error?.message ?? '');
    try {
      if (staleChunk && !sessionStorage.getItem(RELOADED)) {
        sessionStorage.setItem(RELOADED, '1');
        window.location.reload();
      }
    } catch {
      /* stockage indisponible : l'écran de secours suffit */
    }
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
