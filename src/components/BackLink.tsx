import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

/**
 * Bouton retour des pages hors carte (profil, favoris, pages légales). Indispensable dans l'app iOS,
 * qui n'a ni barre d'adresse ni bouton « Précédent ».
 * - home : retour direct à la carte (pages principales : évite les allers-retours profil ↔ connexion)
 * - sinon : page d'avant, ou la carte si l'app a été ouverte directement sur cette page
 */
export function BackLink({ home = false }: { home?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  // react-router numérote les entrées de l'historique : idx > 0 = une page de l'app précède celle-ci
  const canGoBack = !home && ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  return (
    <Link
      to="/"
      onClick={(e) => {
        if (!canGoBack) return;
        e.preventDefault();
        navigate(-1);
      }}
      className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden /> {t('nav.back')}
    </Link>
  );
}
