import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Outlet, useMatch, useOutletContext, useSearchParams } from 'react-router-dom';
import type { GolfSummary } from '../../shared/types';
import { ActionRail } from '../components/ActionRail';
import { SectionBoundary } from '../components/ErrorBoundary';
import { BottomSheet, type Snap } from '../components/BottomSheet';
import { GolfSideCards, InviteForm } from '../components/InviteScreen';
import { Logo } from '../components/Logo';
import { MapView } from '../components/MapView';
import { ResultsList } from '../components/ResultsList';
import { SearchForm } from '../components/SearchForm';
import { haptic } from '../components/ui';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cheapestGreenFee } from '../lib/prices';
import { useSettings } from '../lib/settings';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useResults } from '../lib/useResults';
import { useSearch } from '../state/search';

interface Ctx {
  cardRefs: MutableRefObject<Map<string, HTMLElement>>;
  desktop: boolean;
  inviteGolf: GolfSummary | null;
}
const useLayout = () => useOutletContext<Ctx>();

/** Fait défiler uniquement la liste (scrollIntoView déplacerait aussi la carte). */
function scrollListTo(el: HTMLElement | undefined) {
  const sc = el?.closest<HTMLElement>('[data-scroll]');
  if (!el || !sc) return;
  sc.scrollTo({ top: sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8, behavior: 'smooth' });
}

/**
 * Filtres recopiés dans l'adresse (?date=&from=&to=&holes=&players=&radius=) pour qu'un rechargement les garde.
 * La position n'y est jamais écrite (vie privée) : elle est redemandée à l'ouverture.
 */
function useFiltersInUrl() {
  const { criteria: c, radius } = useSearch();
  const [, setParams] = useSearchParams();
  useEffect(() => {
    setParams({ date: c.date, from: c.timeFrom, to: c.timeTo, holes: c.holes, players: String(c.players), radius: String(radius) }, { replace: true });
  }, [c.date, c.timeFrom, c.timeTo, c.holes, c.players, radius, setParams]);
}

/** Écran d'arrivée (route « / ») : filtres et golfs disponibles. Sur ordinateur, la liste est dans un panneau à droite. */
export function HomeScreen() {
  const { cardRefs, desktop } = useLayout();
  useFiltersInUrl();
  return (
    <div className="animate-rise flex min-h-full flex-col">
      <SearchForm />
      {!desktop && (
        <div className="mt-6 border-t border-line pt-5">
          <ResultsList cardRefs={cardRefs} />
        </div>
      )}
    </div>
  );
}

/** Écran 3 (route « /inviter/:id ») */
export function InviteRoute() {
  const { desktop, inviteGolf } = useLayout();
  return (
    <div className="animate-rise flex min-h-full flex-col">
      <InviteForm golf={inviteGolf} top={!desktop && inviteGolf ? <GolfSideCards golf={inviteGolf} compact /> : null} />
    </div>
  );
}

/**
 * Mise en page commune aux 3 écrans : carte plein écran toujours visible en fond,
 * panneau de verre à gauche (tiroir à 3 crans sur mobile), menu d'actions à droite.
 */
export function MapLayout() {
  const { t } = useI18n();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const invite = useMatch('/inviter/:id');
  const inviteId = invite?.params.id ? decodeURIComponent(invite.params.id) : null;
  const { origin, radius, selectedId, setSelectedId, hoverId, mapHint } = useSearch();
  const { visible, all } = useResults();
  const { money, convert } = useSettings();
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [snap, setSnap] = useState<Snap>('half');

  const fromList = inviteId ? (all.find((g) => g.id === inviteId) ?? null) : null;
  const detail = useQuery({ queryKey: ['golf', inviteId], queryFn: () => api.golf(inviteId!), enabled: !!inviteId && !fromList, staleTime: 10 * 60_000 });
  const inviteGolf = fromList ?? detail.data ?? null;

  // Chaque changement d'écran repart du haut du panneau ; sur mobile, le tiroir reprend sa hauteur par défaut
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => el.scrollTo({ top: 0 }));
    // Recherche : tiroir à mi-hauteur pour voir la carte (cercle du rayon) ; invitation : plein écran
    if (!desktop) setSnap(inviteId ? 'full' : 'half');
  }, [inviteId, desktop]);

  const golfsOnMap = useMemo(() => (inviteId ? (inviteGolf ? [inviteGolf] : []) : visible), [inviteId, inviteGolf, visible]);
  const insets = useMemo(
    () =>
      desktop
        ? { top: 0, bottom: 0, left: !inviteId ? 872 : 460, right: inviteId ? 440 : 90 }
        : { top: 0, bottom: Math.round(window.innerHeight * 0.5), left: 0, right: 0 },
    [desktop, inviteId],
  );

  const labelFor = useCallback(
    (g: GolfSummary) => {
      const p = cheapestGreenFee(g, convert);
      return p ? money(p.amount, p.currency).text.replace('≈ ', '') : null;
    },
    [money, convert],
  );

  // Clic sur un marqueur : la carte correspondante de la liste est mise en surbrillance et amenée à l'écran
  const selectFromMap = useCallback(
    (id: string) => {
      if (inviteId) return;
      haptic();
      setSelectedId(id);
      if (!desktop) setSnap((s) => (s === 'peek' ? 'half' : s));
      setTimeout(() => scrollListTo(cardRefs.current.get(id)), 350);
    },
    [desktop, inviteId, setSelectedId],
  );

  const ctx: Ctx = { cardRefs, desktop, inviteGolf };
  const content = (
    <Suspense fallback={<div className="skeleton mt-2 h-40 w-full rounded-[24px]" aria-hidden />}>
      <Outlet context={ctx} />
    </Suspense>
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <SectionBoundary resetKey={inviteId ?? 'search'}>
      <MapView
        origin={origin}
        golfs={golfsOnMap}
        radiusKm={radius}
        selectedId={inviteId ?? selectedId}
        onSelect={selectFromMap}
        unnamedLabel={t('card.unnamed')}
        labelFor={labelFor}
        insets={insets}
        showRadius={!inviteId}
        focus={inviteId ? inviteGolf : null}
        highlightId={inviteId ? null : hoverId}
        hint={mapHint}
      />
      </SectionBoundary>

      {desktop ? (
        <aside className="glass glass-rounded absolute top-4 bottom-4 left-4 z-[1000] flex w-[420px] flex-col">
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
            <Logo className="size-9" />
            <span className="text-lg font-semibold tracking-tight">
              Golf<span className="text-gold-ink">Us</span>
            </span>
          </div>
          <div data-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5">
            {content}
          </div>
        </aside>
      ) : (
        <BottomSheet snap={snap} onSnap={setSnap} header={null}>
          {content}
        </BottomSheet>
      )}

      {/* Golfs disponibles selon les filtres, mis à jour en direct (ordinateur) */}
      {desktop && !inviteId && (
        <aside aria-label={t('results.list')} className="glass glass-rounded animate-rise absolute top-4 bottom-4 left-[452px] z-[1000] flex w-[404px] flex-col">
          <div data-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
            <ResultsList cardRefs={cardRefs} />
          </div>
        </aside>
      )}

      {desktop && inviteId && inviteGolf && (
        <div className="animate-rise absolute top-4 right-[92px] z-[1000] w-[340px]">
          <GolfSideCards golf={inviteGolf} />
        </div>
      )}

      <ActionRail />
    </div>
  );
}
