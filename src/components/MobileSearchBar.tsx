import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { useResults } from '../lib/useResults';
import { useSearch } from '../state/search';
import { SearchForm, useAutoLocate } from './SearchForm';
import { useLocate } from './SearchControls';
import { Button, haptic } from './ui';

/** Panneau complet des filtres (mobile) : la liste se met à jour derrière, le bouton du bas ramène aux résultats. */
function FiltersPanel({ onClose }: { onClose: () => void }) {
  const { t, tp } = useI18n();
  const { origin } = useSearch();
  const { visible, golfsQ } = useResults();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1550] bg-[rgba(15,26,36,0.25)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={t('s1.title')} className="glass glass-strong animate-rise fixed inset-x-0 bottom-0 z-[1600] mx-auto flex max-h-[88dvh] max-w-[640px] flex-col rounded-t-[28px] pb-[env(safe-area-inset-bottom)]">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-full" aria-label={t('common.close')}>
          <X className="size-5" aria-hidden />
        </button>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
          <SearchForm />
        </div>
        <div className="border-t border-line px-5 py-3">
          <Button variant="primary" className="w-full" onClick={onClose}>
            {!origin ? t('common.close') : golfsQ.data ? tp('s2.count', visible.length) : t('results.loading')}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Résumé des filtres sur une barre (mobile) : tout est visible d'un coup d'œil, un toucher ouvre le panneau complet. */
export function MobileSearchBar() {
  const { t, tp, locale } = useI18n();
  const { draft: c, origin, radius } = useSearch();
  const [open, setOpen] = useState(false);
  const loc = useLocate();
  useAutoLocate(loc);

  const place = !origin ? (loc.busy ? t('search.locating') : t('s2.pickPlace')) : `${origin.label ?? t('bar.myPosition')} · ${radius} km`;
  const date = new Date(`${c.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const details = [
    date,
    `${c.timeFrom}–${c.timeTo}`,
    c.holes === '9' ? t('filters.holes9') : c.holes === '18' ? t('filters.holes18') : null,
    tp('bar.players', c.players),
  ].filter(Boolean);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`${t('bar.edit')} : ${place}, ${details.join(', ')}`}
        className="frost glass-interactive mb-2 flex w-full items-center justify-between gap-2 rounded-[16px] px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{place}</span>
          <span className="block truncate text-xs text-muted tabular-nums">{details.join(' · ')}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-link">
          <SlidersHorizontal className="size-4" aria-hidden /> {t('bar.filters')}
        </span>
      </button>
      {open && <FiltersPanel onClose={() => setOpen(false)} />}
    </>
  );
}
