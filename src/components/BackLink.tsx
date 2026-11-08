import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

/**
 * Une page de l'app précède celle-ci dans l'historique (react-router numérote les entrées : idx > 0).
 * window.history.length ne suffit pas : dans l'app iOS il compte aussi les entrées hors de l'app
 * (ouverture par notification ou par lien), et « Précédent » ne mène alors nulle part.
 */
export const hasAppHistory = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

/**
 * Bouton retour des pages hors carte (profil, favoris, pages légales). Indispensable dans l'app iOS,
 * qui n'a ni barre d'adresse ni bouton « Précédent ».
 * - home : retour direct à la carte (pages principales : évite les allers-retours profil ↔ connexion)
 * - sinon : page d'avant, ou la carte si l'app a été ouverte directement sur cette page
 */
export function BackLink({ home = false, className }: { home?: boolean; className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  // react-router numérote les entrées de l'historique : idx > 0 = une page de l'app précède celle-ci
  const canGoBack = !home && hasAppHistory();
  return (
    <Link
      to="/"
      onClick={(e) => {
        if (!canGoBack) return;
        e.preventDefault();
        navigate(-1);
      }}
      className={className ?? 'inline-flex h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink'}
    >
      <ArrowLeft className="size-4" aria-hidden /> {t('nav.back')}
    </Link>
  );
}
