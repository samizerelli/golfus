import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, Compass, SearchX, ShieldCheck, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RADII_KM, type GolfSummary, type RadiusKm } from '../../shared/types';
import { BottomSheet, type Snap } from '../components/BottomSheet';
import { FilterBar } from '../components/FilterBar';
import { GolfCard, GolfCardSkeleton } from '../components/GolfCard';
import { Logo } from '../components/Logo';
import { MapView } from '../components/MapView';
import { LocateError, LocateInline, LocationSearch, useLocate } from '../components/SearchControls';
import { Button, haptic, Notice } from '../components/ui';
import { useI18n } from '../i18n';
import { ApiError } from '../lib/api';
import { cheapestGreenFee } from '../lib/prices';
import { useSettings } from '../lib/settings';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useResults } from '../lib/useResults';
import { DEFAULT_FILTERS, useSearch } from '../state/search';

/** Fait défiler uniquement le conteneur de liste (scrollIntoView déplacerait aussi la carte). */
function scrollListTo(el: HTMLElement | null | undefined, toTop = false) {
  const sc = el?.closest<HTMLElement>('[data-scroll]');
  if (!el || !sc) return;
  if (toTop) return sc.scrollTo({ top: 0 });
  const delta = el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
  sc.scrollTo({ top: sc.scrollTop + delta, behavior: 'smooth' });
}

const TRY_PLACES = [
  { label: 'Marbella', lat: 36.5101, lon: -4.8825 },
  { label: 'Vilamoura', lat: 37.0779, lon: -8.1175 },
  { label: 'Cannes', lat: 43.5528, lon: 7.0174 },
  { label: 'Lausanne', lat: 46.5197, lon: 6.6323 },
];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  return online;
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center px-6 py-8 text-center" role="status">
      <span className="frost mb-4 grid size-16 place-items-center rounded-full text-glacier-700 dark:text-glacier-300">{icon}</span>
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Welcome() {
  const { t } = useI18n();
  const { setOrigin } = useSearch();
  return (
    <div className="animate-rise space-y-4 px-1 pt-2 pb-4">
      <div>
        <h1 className="text-[26px] leading-tight">{t('welcome.title')}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{t('welcome.body')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t('welcome.try')}</span>
        {TRY_PLACES.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              haptic();
              setOrigin({ lat: p.lat, lon: p.lon, label: p.label, source: 'search' });
            }}
            className="frost glass-interactive h-11 rounded-full px-4 text-sm font-semibold"
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        <span>
          {t('welcome.privacy')}{' '}
          <Link to="/confidentialite" className="text-link underline underline-offset-2">
            {t('nav.privacy')}
          </Link>
        </span>
      </p>
    </div>
  );
}

/** Progression de la première recherche (OSM peut être lent) */
function LoadingState({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(id);
  }, []);
  const progress = Math.min(95, 100 * (1 - Math.exp(-elapsed / 9)));
  const step = elapsed < 3 ? t('results.step1') : elapsed < 14 ? t('results.step2') : t('results.step3');
  return (
    <div aria-busy="true" className="space-y-3">
      <div className="frost rounded-[20px] p-4" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{elapsed < 1.2 ? t('results.loading') : step}</p>
          {elapsed > 1.2 && (
            <button type="button" onClick={onCancel} className="h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-link hover:underline">
              {t('results.cancel')}
            </button>
          )}
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-card-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={t('results.loading')}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-glacier-400 to-fairway-500 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        {elapsed > 3.5 && <p className="mt-2 text-xs text-muted">{t('results.loadingSlow')}</p>}
      </div>
      {[0, 1].map((i) => (
        <GolfCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomePage() {
  const { t, tp } = useI18n();
  const qc = useQueryClient();
  const { money, convert } = useSettings();
  const { origin, radius, setRadius, selectedId, setSelectedId, setFilters } = useSearch();
  const { golfsQ, all, visible, travel, travelLoading } = useResults();
  const loc = useLocate();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [snap, setSnap] = useState<Snap>('half');
  const [cancelled, setCancelled] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const listTop = useRef<HTMLDivElement>(null);

  const insets = useMemo(
    () => (desktop ? { top: 0, bottom: 0, left: 470 } : { top: 150, bottom: Math.round(window.innerHeight * 0.5), left: 0 }),
    [desktop],
  );

  useEffect(() => {
    setCancelled(false);
    scrollListTo(listTop.current, true);
  }, [origin, radius]);

  useEffect(() => {
    if (origin && !desktop) setSnap((s) => (s === 'peek' ? 'half' : s));
  }, [origin, desktop]);

  const selectFromMap = useCallback(
    (id: string) => {
      haptic();
      setSelectedId(id);
      if (!desktop) setSnap((s) => (s === 'full' ? 'half' : s === 'peek' ? 'half' : s));
      setTimeout(() => scrollListTo(cardRefs.current.get(id)), 360);
    },
    [desktop, setSelectedId],
  );

  const labelFor = useCallback(
    (g: GolfSummary) => {
      const p = cheapestGreenFee(g, convert);
      return p ? money(p.amount, p.currency).text.replace('≈ ', '') : null;
    },
    [money, convert],
  );

  const cancel = () => {
    qc.cancelQueries({ queryKey: ['golfs'] });
    setCancelled(true);
  };

  const nextRadius = RADII_KM.find((r) => r > radius) as RadiusKm | undefined;
  const err = golfsQ.error as ApiError | null;
  const placeLabel = origin?.label ?? t('search.myPosition');
  const online = useOnline();

  const summary = origin && golfsQ.data && (
    <div className="pb-2" aria-live="polite">
      <p className="text-[19px] leading-tight font-semibold tracking-tight">{t('search.around', { place: placeLabel })}</p>
      {origin.source === 'ip' && (
        <p className="text-[12px] font-medium text-gold-ink" title={t('geo.ipNote')}>
          ≈ {t('geo.approx')}
        </p>
      )}
      <p className="text-[13px] text-muted">
        {tp('results.count', all.length, { r: radius })}
        {visible.length !== all.length && ` · ${t('results.shown', { shown: visible.length, n: all.length })}`}
      </p>
    </div>
  );

  const list = (
    <div className="space-y-3">
      <div ref={listTop} aria-hidden />
      {!online && <Notice tone="warn">{t('results.offline')}</Notice>}
      {!origin && <Welcome />}

      {origin && golfsQ.isFetching && !golfsQ.data && !cancelled && <LoadingState onCancel={cancel} />}

      {origin && cancelled && !golfsQ.data && !golfsQ.isFetching && (
        <EmptyState
          icon={<SearchX className="size-7" aria-hidden />}
          title={t('results.cancelled')}
          action={
            <Button
              variant="primary"
              onClick={() => {
                setCancelled(false);
                golfsQ.refetch();
              }}
            >
              {t('results.again')}
            </Button>
          }
        />
      )}

      {origin && err && !golfsQ.data && !golfsQ.isFetching && (
        <EmptyState
          icon={err.code === 'network' ? <WifiOff className="size-7" aria-hidden /> : <CloudOff className="size-7" aria-hidden />}
          title={t('results.errorTitle')}
          body={err.status === 503 || err.code === 'network' ? t('results.errorBody') : t('common.error')}
          action={
            <Button variant="primary" onClick={() => golfsQ.refetch()}>
              {t('results.retry')}
            </Button>
          }
        />
      )}

      {golfsQ.data?.stale && <Notice tone="warn">{t('results.stale')}</Notice>}
      {golfsQ.data?.osmUnavailable && <Notice tone="warn">{t('results.partial')}</Notice>}

      {origin && golfsQ.data && all.length === 0 && (
        <EmptyState
          icon={<Compass className="size-7" aria-hidden />}
          title={t('results.emptyTitle')}
          body={t('results.emptyBody', { r: radius })}
          action={
            nextRadius && (
              <Button variant="primary" onClick={() => setRadius(nextRadius)}>
                {t('results.widen', { r: nextRadius })}
              </Button>
            )
          }
        />
      )}

      {origin && all.length > 0 && visible.length === 0 && (
        <EmptyState
          icon={<SearchX className="size-7" aria-hidden />}
          title={t('results.filteredEmpty')}
          action={<Button onClick={() => setFilters(DEFAULT_FILTERS)}>{t('filters.reset')}</Button>}
        />
      )}

      {visible.length > 0 && (
        <ul aria-label={t('results.list')} className="space-y-3">
          {visible.map((g, i) => (
            <li key={g.id}>
              <GolfCard
                ref={(el) => {
                  if (el) cardRefs.current.set(g.id, el);
                  else cardRefs.current.delete(g.id);
                }}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                golf={g}
                travel={travel.get(g.id)}
                travelPending={travelLoading}
                selected={g.id === selectedId}
                onShowOnMap={() => {
                  setSelectedId(g.id);
                  if (!desktop) setSnap('peek');
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <footer className="space-y-1 px-1 py-6 text-center text-xs text-muted">
        <p>
          <Link to="/mentions-legales" className="underline underline-offset-2">
            {t('nav.legal')}
          </Link>{' '}
          ·{' '}
          <Link to="/confidentialite" className="underline underline-offset-2">
            {t('nav.privacy')}
          </Link>
        </p>
        <p>{t('footer.osm')}</p>
      </footer>
    </div>
  );

  const map = (
    <MapView
      origin={origin}
      golfs={visible}
      radiusKm={radius}
      selectedId={selectedId}
      onSelect={selectFromMap}
      unnamedLabel={t('card.unnamed')}
      labelFor={labelFor}
      insets={insets}
    />
  );

  const search = (
    <LocationSearch
      trailing={<LocateInline loc={loc} />}
      // Sur mobile, on replie le tiroir pendant la saisie pour laisser la place au clavier et aux suggestions
      onFocus={() => !desktop && setSnap('peek')}
    />
  );

  if (desktop) {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {map}
        <aside className="glass glass-rounded absolute top-4 bottom-4 left-4 z-[1000] flex w-[440px] flex-col">
          <div className="space-y-3 p-4 pb-2">
            <div className="flex items-center gap-2.5 px-1">
              <Logo className="size-9" />
              <span className="text-lg font-semibold tracking-tight">GolfUs</span>
            </div>
            {search}
            <LocateError loc={loc} />
            <FilterBar className="-mx-4 px-4" />
            {summary}
          </div>
          <div data-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
            {list}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {map}
      <div className="absolute inset-x-0 top-0 z-[1050] space-y-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {search}
        <LocateError loc={loc} />
        <FilterBar className="-mx-3 px-3" />
      </div>
      <BottomSheet snap={snap} onSnap={setSnap} header={summary}>
        {list}
      </BottomSheet>
    </div>
  );
}
