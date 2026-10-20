import { CircleHelp, Globe, Heart, Navigation, Phone, Share2 } from 'lucide-react';
import { useState, type CSSProperties, type MouseEvent } from 'react';
import type { GolfSummary } from '../../shared/types';
import { useI18n } from '../i18n';
import { useFavorites } from '../lib/favorites';
import { formatIntervals, intervalsOn, nextChange, parseHours, stateAt, useHoursLib } from '../lib/hours';
import { directionsUrl, telHref } from '../lib/links';
import { mainCategory, priceFor, priceMatrix } from '../lib/prices';
import { useSettings } from '../lib/settings';
import { useSearch } from '../state/search';
import { BookingButton } from './BookingButton';
import { Badge, buttonClass, cx, haptic } from './ui';

/** Illustration de remplacement quand aucune photo libre n'est disponible */
export function GolfPhoto({ src, alt, className, style }: { src: string | null; alt: string; className?: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cx('object-cover', className)} style={style} />;
  }
  return (
    <div className={cx('relative overflow-hidden', className)} style={style} role="img" aria-label={alt}>
      <svg viewBox="0 0 320 180" style={{ filter: 'var(--placeholder-filter, none)' }} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c6def2" />
            <stop offset="1" stopColor="#eef5fb" />
          </linearGradient>
          <linearGradient id="ph-hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4f9a7f" />
            <stop offset="1" stopColor="#1f5d4a" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#ph-sky)" />
        <path d="M0 122 Q70 92 150 112 T320 102 V180 H0Z" fill="#8fc7b0" opacity=".8" />
        <path d="M0 146 Q90 118 190 138 T320 132 V180 H0Z" fill="url(#ph-hill)" />
        <ellipse cx="196" cy="138" rx="34" ry="6" fill="#b0d5c6" />
        <line x1="196" y1="138" x2="196" y2="76" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M196 76 L222 85 L196 94Z" fill="#d9c7a0" />
      </svg>
    </div>
  );
}

function shortTime(d: Date, locale: string) {
  if (locale.startsWith('fr')) {
    return d.getMinutes() ? `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours()} h`;
  }
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Pastille compacte « Ouvert · jusqu'à 19 h » / « Fermé » pour les cartes */
export function OpenPill({ golf }: { golf: GolfSummary }) {
  const { t, locale } = useI18n();
  const { playAt } = useSearch();
  const ready = useHoursLib();
  if (!golf.openingHours) return null;
  if (!ready) return <span className="skeleton inline-block h-7 w-32 rounded-full" aria-hidden />;
  const oh = parseHours(golf.openingHours, golf.lat, golf.lon);
  const state = stateAt(oh, playAt);
  if (state === 'unknown') return <Badge>{t('hours.uncertain')}</Badge>;
  const change = nextChange(oh, playAt);
  if (state === 'open') {
    return <Badge tone="green">{change ? t('hours.openUntil', { t: shortTime(change, locale) }) : t('hours.open')}</Badge>;
  }
  return <Badge tone="red">{t('hours.closedShort')}</Badge>;
}

export function OpenStatus({ golf, withDetail = true }: { golf: GolfSummary; withDetail?: boolean }) {
  const { t, locale } = useI18n();
  const { playAt, isNow } = useSearch();
  const ready = useHoursLib();
  const oh = parseHours(golf.openingHours, golf.lat, golf.lon);
  if (golf.openingHours && !ready) return <span className="skeleton block h-5 w-48" aria-hidden />;
  const state = stateAt(oh, playAt);
  const today = intervalsOn(oh, playAt);

  if (!golf.openingHours || (!oh && golf.openingHours)) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <CircleHelp className="size-4" aria-hidden />
        {t('hours.unknown')}
      </p>
    );
  }

  const change = nextChange(oh, playAt);
  const fmtTime = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = change && change.toDateString() === playAt.toDateString();
  let detail = '';
  if (change && state === 'open') detail = t('hours.closesAt', { t: fmtTime(change) });
  if (change && state === 'closed')
    detail = t('hours.opensAt', {
      when: sameDay ? '' : change.toLocaleDateString(locale, { weekday: 'long' }),
      t: fmtTime(change),
    }).replace('  ', ' ');

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {state === 'open' && <Badge tone="green">● {isNow ? t('hours.openNow') : t('hours.openAtTime')}</Badge>}
      {state === 'closed' && <Badge tone="red">● {isNow ? t('hours.closedNow') : t('hours.closedAtTime')}</Badge>}
      {state === 'unknown' && <Badge>{t('hours.uncertain')}</Badge>}
      {withDetail && (
        <span className="text-muted">
          {today && today.length > 0 ? formatIntervals(today, locale) : t('hours.closedAllDay')}
          {detail && <> · {detail}</>}
        </span>
      )}
    </div>
  );
}

export function ReliabilityNote({ golf }: { golf: GolfSummary }) {
  const { t, locale } = useI18n();
  if (golf.priceReliability === 'verified') {
    return (
      <p className="text-xs text-fairway-700 dark:text-fairway-300">
        ✓{' '}
        {golf.priceUpdatedAt
          ? t('price.verifiedOn', { date: new Date(golf.priceUpdatedAt).toLocaleDateString(locale) })
          : t('price.verified')}
      </p>
    );
  }
  return (
    <p className="text-xs font-medium text-gold-ink">
      ⚠ {golf.priceUpdatedAt ? t('price.indicativeOn', { date: new Date(golf.priceUpdatedAt).toLocaleDateString(locale) }) : t('price.indicative')}
    </p>
  );
}

export function PriceSummary({ golf }: { golf: GolfSummary }) {
  const { t } = useI18n();
  const { money } = useSettings();
  const { playAt } = useSearch();
  const cat = mainCategory(golf.prices);

  if (!cat) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          {t('price.greenFee')} : <span className="font-medium text-ink">{t('price.notProvided')}</span>
        </span>
        {golf.phone && (
          <a href={telHref(golf.phone)} className="font-medium text-fairway-700 underline underline-offset-2 dark:text-fairway-300">
            {t('action.callToAsk')}
          </a>
        )}
        {golf.pricingUrl && (
          <a href={golf.pricingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-fairway-700 underline underline-offset-2 dark:text-fairway-300">
            {t('action.pricingPage')}
          </a>
        )}
      </div>
    );
  }

  const current = priceFor(golf.prices, cat, golf.highSeasonMonths, playAt);
  const m = priceMatrix(golf.prices, cat);
  const cur = current ? money(current.amount, current.currency) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">{t(`price.cat.${cat}`)}</span>
        {cur && (
          <span className="text-right">
            <span className="font-display text-xl font-semibold text-ink" title={cur.converted ? cur.original : undefined}>
              {cur.text}
            </span>
            <span className="block text-[11px] text-muted">{t('price.forDate')}</span>
          </span>
        )}
      </div>
      {(m.seasonal || m.daily) && (
        <table className="w-full text-xs">
          <caption className="sr-only">{t(`price.cat.${cat}`)}</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="text-left font-normal" />
              <th scope="col" className="text-right font-normal">{m.daily ? t('price.weekday') : t('price.all')}</th>
              {m.daily && <th scope="col" className="text-right font-normal">{t('price.weekend')}</th>}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.season}>
                <th scope="row" className="text-left font-normal text-muted">
                  {r.season === 'low' ? t('price.low') : r.season === 'high' ? t('price.high') : t('price.allYear')}
                </th>
                <td className="text-right font-medium tabular-nums">{r.weekday ? money(r.weekday.amount, r.weekday.currency).text : '—'}</td>
                {m.daily && (
                  <td className="text-right font-medium tabular-nums">{r.weekend ? money(r.weekend.amount, r.weekend.currency).text : '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ReliabilityNote golf={golf} />
    </div>
  );
}

export function FavoriteButton({ golf, className }: { golf: GolfSummary; className?: string }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(golf.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(golf);
        haptic(fav ? 6 : 14);
      }}
      aria-pressed={fav}
      aria-label={fav ? t('action.unfavorite') : t('action.favorite')}
      title={fav ? t('action.unfavorite') : t('action.favorite')}
      className={cx('glass glass-interactive grid size-11 place-items-center rounded-full', className)}
    >
      <Heart className={cx('size-5 transition-transform duration-300', fav ? 'scale-110 fill-gold-500 text-gold-700' : 'text-ink')} aria-hidden />
    </button>
  );
}

export function ShareButton({ golf, variant = 'secondary' }: { golf: GolfSummary; variant?: 'secondary' | 'icon' }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/golf/${encodeURIComponent(golf.id)}`;
    const text = t('share.text', { name: golf.name });
    if (navigator.share) {
      try {
        await navigator.share({ title: golf.name, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t('action.share'), url);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={share}
        className={variant === 'icon' ? 'glass glass-interactive grid size-11 place-items-center rounded-full' : buttonClass('secondary', 'sm')}
        aria-label={variant === 'icon' ? t('action.share') : undefined}
      >
        <Share2 className="size-4" aria-hidden />
        {variant !== 'icon' && t('action.share')}
      </button>
      <span role="status" aria-live="polite" className={copied ? 'glass animate-rise fixed bottom-24 left-1/2 z-[2000] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-medium' : 'sr-only'}>
        {copied ? t('share.copied') : ''}
      </span>
    </>
  );
}

/** Boutons Itinéraire / Appeler / Site web / Réserver */
export function GolfActions({ golf, size = 'sm' }: { golf: GolfSummary; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div className={cx('flex gap-2', size === 'sm' ? 'no-scrollbar -mx-4 overflow-x-auto px-4' : 'flex-wrap')}>
      <BookingButton golf={golf} size={size} />
      <a href={directionsUrl(golf.lat, golf.lon, golf.name)} {...ext} onClick={stop} className={buttonClass('secondary', size)}>
        <Navigation className="size-4" aria-hidden />
        {t('action.directions')}
        <span className="sr-only">{t('action.opensNewTab')}</span>
      </a>
      {golf.phone ? (
        <a href={telHref(golf.phone)} onClick={stop} className={buttonClass('secondary', size)}>
          <Phone className="size-4" aria-hidden />
          {t('action.call')}
        </a>
      ) : (
        <span className={cx(buttonClass('secondary', size), 'pointer-events-none opacity-50')} aria-disabled="true" title={t('action.noPhone')}>
          <Phone className="size-4" aria-hidden />
          {t('action.call')}
          <span className="sr-only">— {t('action.noPhone')}</span>
        </span>
      )}
      {golf.website && (
        <a href={golf.website} {...ext} onClick={stop} className={buttonClass('secondary', size)}>
          <Globe className="size-4" aria-hidden />
          {t('action.website')}
          <span className="sr-only">{t('action.opensNewTab')}</span>
        </a>
      )}
    </div>
  );
}
