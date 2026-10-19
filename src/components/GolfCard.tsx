import { Car, MapPin, MapPinned } from 'lucide-react';
import { forwardRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { GolfSummary, TravelInfo } from '../../shared/types';
import { useI18n } from '../i18n';
import { cheapestGreenFee, mainCategory, priceMatrix } from '../lib/prices';
import { useSettings } from '../lib/settings';
import { FavoriteButton, GolfActions, GolfPhoto, OpenPill } from './GolfBits';
import { Badge, cx, haptic, Stars } from './ui';

export function golfName(g: GolfSummary, unnamed: string) {
  return g.name || unnamed;
}

/** Nom CSS de transition partagée (View Transitions API) pour la photo d'un golf */
export const vtName = (id: string) => `golf-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

function PriceLine({ golf }: { golf: GolfSummary }) {
  const { t } = useI18n();
  const { money, convert } = useSettings();
  const cheapest = cheapestGreenFee(golf, convert);
  if (!cheapest) {
    return <p className="max-w-[7.5rem] text-right text-xs text-muted">{t('price.notProvided')}</p>;
  }
  const m = priceMatrix(golf.prices, mainCategory(golf.prices)!);
  const span = (season: 'low' | 'high') => {
    const r = m.rows.find((x) => x.season === season);
    const vals = [r?.weekday, r?.weekend].filter((p): p is NonNullable<typeof p> => !!p);
    if (!vals.length) return '—';
    const sorted = vals.sort((a, b) => a.amount - b.amount);
    const lo = money(sorted[0].amount, sorted[0].currency).text.replace('≈ ', '');
    const hi = money(sorted[sorted.length - 1].amount, sorted[sorted.length - 1].currency).text.replace('≈ ', '');
    return lo === hi ? hi : `${lo.replace(/[^\d\s.,]/g, '').trim()}–${hi}`;
  };
  const v = money(cheapest.amount, cheapest.currency);
  return (
    <div className="text-right">
      <p className="text-[13px] text-muted">
        {t('price.from', { p: '' }).trim()}{' '}
        <span className="text-xl font-semibold tracking-tight text-ink tabular-nums" title={v.converted ? v.original : undefined}>
          {v.text}
        </span>
      </p>
      {m.seasonal && (
        <p className="text-[11px] leading-snug whitespace-nowrap text-muted tabular-nums">
          {t('price.lowShort')} {span('low')}
          <br />
          {t('price.highShort')} {span('high')}
        </p>
      )}
      {golf.priceReliability !== 'verified' && <p className="text-[11px] font-medium text-gold-ink">{t('price.indicative')}</p>}
    </div>
  );
}

export const GolfCard = forwardRef<
  HTMLElement,
  {
    golf: GolfSummary;
    travel?: TravelInfo;
    travelPending?: boolean;
    selected: boolean;
    onShowOnMap: () => void;
    onHover?: (on: boolean) => void;
    style?: CSSProperties;
  }
>(function GolfCard({ golf, travel, travelPending, selected, onShowOnMap, onHover, style }, ref) {
  const { t, tp, locale } = useI18n();
  const name = golfName(golf, t('card.unnamed'));
  const headingId = `golf-${golf.id}-title`;
  const to = `/golf/${encodeURIComponent(golf.id)}`;

  return (
    <article
      ref={ref}
      aria-labelledby={headingId}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={style}
      className={cx(
        'frost animate-rise overflow-hidden rounded-[28px] transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        selected && 'shadow-[0_0_0_2px_#7fb6e6,0_12px_32px_rgba(31,70,110,0.18)]',
      )}
    >
      <div className="relative">
        <Link to={to} viewTransition tabIndex={-1} aria-hidden className="block">
          <GolfPhoto src={golf.photo} alt="" className={cx('w-full', golf.photo ? 'aspect-[16/9]' : 'aspect-[21/8]')} style={{ viewTransitionName: vtName(golf.id) }} />
        </Link>
        {/* Fondu de la photo vers le verre */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/50 to-transparent dark:from-[#16222e]/60" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {golf.isDemo && (
            <Badge tone="demo" title={t('demo.notice')}>
              {t('demo.badge')}
            </Badge>
          )}
          <OpenPill golf={golf} />
        </div>
        <div className="absolute top-2 right-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              haptic();
              onShowOnMap();
            }}
            className="glass glass-interactive grid size-11 place-items-center rounded-full"
            aria-label={t('card.select', { name })}
            title={t('card.showOnMap')}
          >
            <MapPinned className="size-5" aria-hidden />
          </button>
          <FavoriteButton golf={golf} />
        </div>
      </div>

      <div className="space-y-3 px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={headingId} className="text-[19px] leading-snug [overflow-wrap:anywhere]">
              <Link to={to} viewTransition className="-my-2.5 block rounded-md py-2.5 hover:underline">
                {name}
              </Link>
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted tabular-nums">
              {golf.distanceKm !== undefined && (
                <span className="inline-flex items-center gap-1" title={t('card.crow')}>
                  <MapPin className="size-3.5" aria-hidden />
                  {t('card.km', { d: golf.distanceKm.toLocaleString(locale) })}
                </span>
              )}
              {travel?.durationMin != null && (
                <span className="inline-flex items-center gap-1" title={travel.estimated ? t('card.driveEstTitle') : t('card.driveTitle')}>
                  <Car className="size-3.5" aria-hidden />
                  <span className="sr-only">{travel.estimated ? t('card.driveEstTitle') : t('card.driveTitle')} :</span>
                  {travel.estimated ? t('card.driveEst', { m: travel.durationMin }) : t('card.drive', { m: travel.durationMin })}
                </span>
              )}
              {travel === undefined && travelPending && <span className="skeleton inline-block h-3.5 w-12" aria-hidden />}
              {golf.holes && <span>{t('card.holes', { n: golf.holes })}</span>}
              {golf.par && <span>{t('card.par', { n: golf.par })}</span>}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              {golf.rating ? (
                <>
                  <Stars value={golf.rating.average} />
                  <span className="font-semibold text-ink tabular-nums">{golf.rating.average.toLocaleString(locale)}</span>
                  <span className="sr-only">/ 5</span>
                  <span>({tp('card.reviews', golf.rating.count)})</span>
                </>
              ) : (
                t('card.noRating')
              )}
            </p>
          </div>
          <PriceLine golf={golf} />
        </div>
        {!golf.openingHours && <p className="text-xs text-muted">{t('hours.unknown')}</p>}
        <GolfActions golf={golf} />
      </div>
    </article>
  );
});

export function GolfCardSkeleton() {
  return (
    <div className="frost overflow-hidden rounded-[28px]" aria-hidden="true">
      <div className="skeleton aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="flex justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-3.5 w-1/2" />
          </div>
          <div className="skeleton h-8 w-20" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-11 w-32 rounded-[20px]" />
          <div className="skeleton h-11 w-24 rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}
