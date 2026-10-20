import { Car, ChevronRight, CircleHelp, Compass, MapPin, Phone } from 'lucide-react';
import { forwardRef, useRef, type CSSProperties, type MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { RADII_KM, type GolfSummary, type RadiusKm, type TravelInfo } from '../../shared/types';
import { useI18n } from '../i18n';
import type { ApiError } from '../lib/api';
import { cheaperElsewhere } from '../lib/booking';
import { pricePerPerson, type GolfMatch } from '../lib/criteria';
import { formatIntervals, intervalsOn, parseHours, useHoursLib } from '../lib/hours';
import { telHref } from '../lib/links';
import { useSettings } from '../lib/settings';
import { useResults } from '../lib/useResults';
import { DEFAULT_CRITERIA, useSearch, type Criteria } from '../state/search';
import { GolfPhoto } from './GolfBits';
import { vtName } from '../lib/golf';
import { Badge, Button, cx, Notice, Stars } from './ui';

/** Note sur 5 avec sa source et le nombre d'avis, ou « Pas encore noté ». */
export function RatingLine({ golf, size = 'sm' }: { golf: GolfSummary; size?: 'sm' | 'md' }) {
  const { t, tp, locale } = useI18n();
  if (!golf.rating) return <span className="text-xs text-muted">{t('s2.notRated')}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <Stars value={golf.rating.average} size={size} />
      <span className={cx('font-semibold text-ink tabular-nums', size === 'md' && 'text-lg')}>{golf.rating.average.toLocaleString(locale)}</span>
      <span className="sr-only">/ 5</span>
      <span>· {tp('s2.reviews', golf.rating.count)}</span>
    </span>
  );
}

/** Prix par personne pour la date et le créneau choisis, ou « Tarif à confirmer » + Appeler. */
/** inCard : version courte pour les cartes de la liste (le bouton Appeler est alors en bas de la carte). */
export function PricePerPerson({ golf, criteria, large = false, inCard = false }: { golf: GolfSummary; criteria: Criteria; large?: boolean; inCard?: boolean }) {
  const { t } = useI18n();
  const { money } = useSettings();
  const p = pricePerPerson(golf, criteria);
  // Moins cher ailleurs (plateforme ou réservation en ligne du club), ou seul prix connu
  const alt = cheaperElsewhere(golf, criteria);
  const altLine = alt && alt.amount != null && (
    <span className="block text-[11px] font-semibold text-fairway-700 tabular-nums dark:text-fairway-300">
      {t(p ? 's2.orElsewhere' : 's2.elsewhere', { p: money(alt.amount, alt.currency).text, where: alt.kind === 'platform' ? alt.name : t('s2.onlineClub') })}
    </span>
  );
  if (!p && alt && alt.amount != null)
    return (
      <span className={cx('text-right', inCard && 'shrink-0')}>
        <span className="text-xs text-muted">{t('s2.from')} </span>
        <span className={cx('font-semibold tracking-tight tabular-nums', large ? 'text-3xl' : 'text-xl')}>{money(alt.amount, alt.currency).text}</span>
        <span className="block text-[11px] text-muted">{alt.kind === 'platform' ? alt.name : t('s2.onlineClub')}</span>
        <span className="block text-[11px] font-medium text-gold-ink">{t('s2.indicative')}</span>
      </span>
    );
  if (!p && inCard) return <span className="shrink-0 pt-0.5 text-xs font-medium whitespace-nowrap text-muted">{t('s2.priceToConfirm')}</span>;
  if (!p)
    return (
      <span className="flex flex-col items-end gap-1 text-right">
        <span className={cx('font-semibold', large ? 'text-lg' : 'text-sm')}>{t('s2.priceToConfirm')}</span>
        {golf.phone && (
          <a href={telHref(golf.phone)} onClick={(e) => e.stopPropagation()} className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-link hover:underline">
            <Phone className="size-3.5" aria-hidden /> {t('action.call')}
          </a>
        )}
      </span>
    );
  const v = money(p.amount, p.currency);
  // Tranche horaire du tarif retenu (twilight dès 14:00, départs 08:00–08:50…)
  const window = p.category === 'twilight' && p.fromTime ? t('s2.twilightFrom', { t: p.fromTime }) : p.fromTime || p.toTime ? t('s2.window', { a: p.fromTime ?? '', b: p.toTime ?? '' }) : null;
  return (
    <span className="text-right">
      {p.varies && <span className="text-xs text-muted">{t('s2.from')} </span>}
      <span className={cx('font-semibold tracking-tight tabular-nums', large ? 'text-3xl' : 'text-xl')} title={v.converted ? v.original : undefined}>
        {v.text}
      </span>
      <span className="text-xs text-muted"> {t('s2.perPerson')}</span>
      {window && <span className="block text-[11px] text-muted tabular-nums">{window}</span>}
      {altLine}
      <span className="block text-[11px] font-medium text-gold-ink">{t('s2.indicative')}</span>
    </span>
  );
}

/** Horaires du jour choisi + statut sur le créneau. */
export function SlotStatus({ golf, match, date }: { golf: GolfSummary; match?: GolfMatch; date: string }) {
  const { t, locale } = useI18n();
  const ready = useHoursLib();
  const oh = parseHours(golf.openingHours, golf.lat, golf.lon);
  if (!golf.openingHours || (ready && !oh))
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <CircleHelp className="size-3.5" aria-hidden /> {t('s2.hoursUnknown')}
      </span>
    );
  if (!ready) return <span className="skeleton inline-block h-5 w-32" aria-hidden />;
  const day = intervalsOn(oh, new Date(`${date}T00:00:00`)) ?? [];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
      {match?.openInSlot === true && <Badge tone="green">{t('s2.openSlot')}</Badge>}
      {match?.openInSlot === false && <Badge tone="red">{t('s2.closedSlot')}</Badge>}
      <span className="tabular-nums">{day.length ? formatIntervals(day, locale) : t('hours.closedAllDay')}</span>
    </span>
  );
}

const ResultCard = forwardRef<
  HTMLLIElement,
  { golf: GolfSummary; match?: GolfMatch; travel?: TravelInfo; selected: boolean; onHover: (on: boolean) => void; onOpen: () => void; style?: CSSProperties }
>(function ResultCard({ golf, match, travel, selected, onHover, onOpen, style }, ref) {
  const { t, locale } = useI18n();
  const { criteria } = useSearch();
  const name = golf.name || t('card.unnamed');
  return (
    <li ref={ref} style={style} className="animate-rise">
      <div
        role="link"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        aria-label={`${name} — ${t('s2.choose')}`}
        className={cx(
          'frost glass-interactive flex cursor-pointer gap-3 rounded-[24px] p-2.5 pr-3',
          selected && 'shadow-[0_0_0_2px_#7fb6e6,0_12px_32px_rgba(31,70,110,0.18)]',
        )}
      >
        <GolfPhoto src={golf.photo} alt="" className="h-[92px] w-[84px] shrink-0 rounded-[18px]" style={{ viewTransitionName: vtName(golf.id) }} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16px] leading-snug [overflow-wrap:anywhere]">{name}</h3>
            <PricePerPerson golf={golf} criteria={criteria} inCard />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted tabular-nums">
            {golf.distanceKm !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {t('card.km', { d: golf.distanceKm.toLocaleString(locale) })}
              </span>
            )}
            {travel?.durationMin != null && (
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5" aria-hidden />
                {travel.estimated ? t('card.driveEst', { m: travel.durationMin }) : t('card.drive', { m: travel.durationMin })}
              </span>
            )}
            <span>{golf.holes ? t('card.holes', { n: golf.holes }) : t('s2.holesUnknown')}</span>
            {golf.isDemo && <Badge tone="demo">{t('demo.badge')}</Badge>}
          </p>
          <RatingLine golf={golf} />
          <div className="flex items-center justify-between gap-2">
            <SlotStatus golf={golf} match={match} date={criteria.date} />
            <span className="flex shrink-0 items-center gap-1">
              {golf.phone && !pricePerPerson(golf, criteria) && (
                <a
                  href={telHref(golf.phone)}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-card-2 px-2.5 text-xs font-semibold text-link"
                  aria-label={`${t('action.call')} ${name}`}
                >
                  <Phone className="size-3.5" aria-hidden /> {t('action.call')}
                </a>
              )}
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </li>
  );
});

/** Golfs disponibles selon les filtres, recalculés à chaque changement. */
export function ResultsList({ cardRefs }: { cardRefs: MutableRefObject<Map<string, HTMLElement>> }) {
  const { t, tp } = useI18n();
  const navigate = useNavigate();
  const { criteria: c, setCriteria, origin, radius, setRadius, selectedId, setSelectedId, hoverId, setHoverId } = useSearch();
  const { golfsQ, all, visible, matches, travel } = useResults();
  const topRef = useRef<HTMLDivElement>(null);
  const err = golfsQ.error as ApiError | null;
  const next = RADII_KM.find((r) => r > radius) as RadiusKm | undefined;

  return (
    <div className="space-y-3" ref={topRef}>
      <h2 className="text-[17px] font-semibold" aria-live="polite">
        {!origin ? t('s2.pickPlace') : golfsQ.data ? tp('s2.count', visible.length) : t('results.loading')}
      </h2>
      {!origin && <p className="text-sm text-muted">{t('s2.pickPlaceBody')}</p>}

      {golfsQ.isFetching && !golfsQ.data && (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="frost flex gap-3 rounded-[24px] p-2.5">
              <div className="skeleton h-[92px] w-[84px] rounded-[18px]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </li>
          ))}
          <p className="text-center text-xs text-muted">{t('results.loadingSlow')}</p>
        </ul>
      )}
      {err && !golfsQ.data && (
        <Notice tone="error" action={<Button size="sm" onClick={() => golfsQ.refetch()}>{t('results.retry')}</Button>}>
          {t('results.errorBody')}
        </Notice>
      )}
      {golfsQ.data && visible.length === 0 && (
        <div className="frost flex flex-col items-center rounded-[24px] px-5 py-7 text-center" role="status">
          <Compass className="mb-3 size-8 text-glacier-700 dark:text-glacier-300" aria-hidden />
          <p className="text-lg font-semibold">{t('s2.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('s2.emptyBody')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {next && (
              <Button variant="primary" onClick={() => setRadius(next)}>
                {t('s2.widen')} ({next} km)
              </Button>
            )}
            <Button
              onClick={() => {
                const d = DEFAULT_CRITERIA();
                setCriteria({ holes: 'any', minRating: 0, hideUnknown: false, timeFrom: '06:00', timeTo: '21:00', players: c.players, date: c.date ?? d.date });
              }}
            >
              {t('s2.relax')}
            </Button>
          </div>
        </div>
      )}
      <ul className="space-y-2" aria-label={t('results.list')}>
        {visible.map((g, i) => (
          <ResultCard
            key={g.id}
            ref={(el) => {
              if (el) cardRefs.current.set(g.id, el);
              else cardRefs.current.delete(g.id);
            }}
            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            golf={g}
            match={matches.get(g.id)}
            travel={travel.get(g.id)}
            selected={g.id === selectedId || g.id === hoverId}
            onHover={(on) => setHoverId(on ? g.id : null)}
            onOpen={() => {
              setSelectedId(g.id);
              navigate(`/inviter/${encodeURIComponent(g.id)}`, { viewTransition: true });
            }}
          />
        ))}
      </ul>
      {all.length > 0 && <p className="pt-2 text-center text-xs text-muted">{t('footer.osm')}</p>}
    </div>
  );
}
