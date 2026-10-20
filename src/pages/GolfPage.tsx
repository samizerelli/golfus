import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleHelp, ExternalLink, Flag, Mail, MapPin, Pencil, Phone, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SERVICE_KEYS, type GolfDetail, type PriceCategory, type PriceRow } from '../../shared/types';
import { FavoriteButton, GolfActions, GolfPhoto, OpenStatus, ReliabilityNote, ShareButton } from '../components/GolfBits';
import { golfName, vtName } from '../lib/golf';
import { GlassButton, GlassCard } from '../components/glass';
import { Badge, Button, buttonClass, cx, Notice, Stars } from '../components/ui';
import { useI18n } from '../i18n';
import { api, ApiError } from '../lib/api';
import { haversineKm } from '../lib/geo';
import { formatIntervals, intervalsOn, parseHours, useHoursLib, weekStart } from '../lib/hours';
import { appleDirections, displayHost, googleDirections, telHref } from '../lib/links';
import { inDateRange, priceMatrix } from '../lib/prices';
import { useSettings } from '../lib/settings';
import { useSearch } from '../state/search';

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <GlassCard role="region" aria-labelledby={id} className="p-5">
      <h2 id={id} className="mb-3 text-xl">
        {title}
      </h2>
      {children}
    </GlassCard>
  );
}

function PricesSection({ golf }: { golf: GolfDetail }) {
  const { t, locale } = useI18n();
  const { money, currency, rates } = useSettings();
  // Tarifs par tranche horaire (early bird, twilight…) : présentés en liste par saison au lieu d'un tableau
  const timed = golf.prices.some((p) => p.fromTime || p.toTime || p.fromDate || p.toDate);
  const grid: PriceCategory[] = timed ? ['green_fee_18', 'green_fee_9', 'twilight'] : ['green_fee_18', 'green_fee_9'];
  const present = grid.filter((c) => golf.prices.some((p) => p.category === c));
  const extras = golf.prices.filter((p) => !grid.includes(p.category));
  const converted = golf.prices.some((p) => p.currency !== currency) && rates;
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(locale, { month: 'long' });

  if (!golf.prices.length) {
    return (
      <div className="space-y-3">
        <p className="font-medium">{t('price.notProvided')}</p>
        <div className="flex flex-wrap gap-2">
          {golf.phone && (
            <a href={telHref(golf.phone)} className={buttonClass('primary', 'sm')}>
              <Phone className="size-4" aria-hidden /> {t('action.callToAsk')}
            </a>
          )}
          {golf.pricingUrl && (
            <a href={golf.pricingUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
              <ExternalLink className="size-4" aria-hidden /> {t('action.pricingPage')}
            </a>
          )}
        </div>
      </div>
    );
  }

  const label = (s: string) => (s === 'low' ? t('price.low') : s === 'high' ? t('price.high') : t('price.allYear'));
  const dayLabel = (d: string) => (d === 'weekday' ? t('price.weekday') : d === 'weekend' ? t('price.weekend') : t('price.all'));

  const windowLabel = (p: { fromTime?: string | null; toTime?: string | null }) =>
    p.fromTime && p.toTime ? `${p.fromTime}–${p.toTime}` : p.fromTime ? t('price.fromTime', { t: p.fromTime }) : p.toTime ? t('price.untilTime', { t: p.toTime }) : null;
  // Groupes : périodes datées (dans l'ordre de l'année, période en cours mise en avant) ou saisons
  const md = (s: string) => new Date(2000, Number(s.slice(0, 2)) - 1, Number(s.slice(3))).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const groupOf = (p: PriceRow) => (p.fromDate || p.toDate ? `${p.fromDate ?? '01-01'}|${p.toDate ?? '12-31'}` : p.season);
  const groups = [...new Set(golf.prices.filter((p) => grid.includes(p.category)).map(groupOf))].sort();
  const today = new Date();
  const groupTitle = (k: string) => {
    if (!k.includes('|')) return k === 'all' ? null : label(k);
    const [a, b] = k.split('|');
    return t('price.period', { a: md(a), b: md(b) });
  };
  const isNow = (k: string) => k.includes('|') && inDateRange({ fromDate: k.split('|')[0], toDate: k.split('|')[1] }, today);

  return (
    <div className="space-y-4">
      {timed && (() => {
        // Période en cours d'abord ; les autres périodes repliées pour garder la fiche lisible
        const renderGroup = (s: string) => (<table key={s} className={cx('w-full text-sm', isNow(s) && 'rounded-[16px] outline-2 outline-offset-4 outline-fairway-500/40')}>
            <caption className="mb-1 text-left font-semibold">
              {t('price.greenFees')}
              {groupTitle(s) && <span className="font-normal text-muted"> · {groupTitle(s)}</span>}
              {isNow(s) && <span className="ml-2 align-middle"><Badge tone="green">{t('price.now')}</Badge></span>}
            </caption>
            <tbody>
              {golf.prices
                .filter((p) => grid.includes(p.category) && groupOf(p) === s)
                .sort((a, b) => (a.fromTime ?? '').localeCompare(b.fromTime ?? ''))
                .map((p, i) => {
                  const v = money(p.amount, p.currency);
                  return (
                    <tr key={i} className="border-b border-line/60">
                      <th scope="row" className="py-2 text-left font-normal">
                        {t(`price.cat.${p.category}`)}
                        {(windowLabel(p) || p.dayType !== 'all') && (
                          <span className="text-muted tabular-nums"> · {[windowLabel(p), p.dayType !== 'all' && dayLabel(p.dayType)].filter(Boolean).join(', ')}</span>
                        )}
                        {p.note && <span className="block text-xs text-muted">{p.note}</span>}
                      </th>
                      <td className="py-2 text-right text-base font-semibold tabular-nums" title={v.converted ? v.original : undefined}>
                        {v.text}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>);
        const current = groups.filter(isNow);
        const others = groups.filter((g) => !isNow(g));
        return current.length && others.length ? (
          <>
            {current.map(renderGroup)}
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-link">{t('price.otherPeriods', { n: others.length })}</summary>
              <div className="mt-3 space-y-4">{others.map(renderGroup)}</div>
            </details>
          </>
        ) : (
          groups.map(renderGroup)
        );
      })()}
      {!timed && present.map((cat) => {
        const m = priceMatrix(golf.prices, cat);
        return (
          <table key={cat} className="w-full text-sm">
            <caption className="mb-1 text-left font-semibold">{t(`price.cat.${cat}`)}</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-1.5 text-left font-normal">
                  <span className="sr-only">{t('price.low')} / {t('price.high')}</span>
                </th>
                <th scope="col" className="py-1.5 text-right font-normal">{m.daily ? t('price.weekday') : t('price.all')}</th>
                {m.daily && <th scope="col" className="py-1.5 text-right font-normal">{t('price.weekend')}</th>}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.season} className="border-b border-line/60">
                  <th scope="row" className="py-2 text-left font-normal">{label(r.season)}</th>
                  {[r.weekday, ...(m.daily ? [r.weekend] : [])].map((p, i) => {
                    const v = p && money(p.amount, p.currency);
                    return (
                      <td key={i} className="py-2 text-right text-base font-semibold tabular-nums" title={v && v.converted ? v.original : undefined}>
                        {v ? v.text : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      {golf.highSeasonMonths.length > 0 && (
        <p className="text-sm text-muted">{t('price.highSeason', { months: golf.highSeasonMonths.map(monthName).join(', ') })}</p>
      )}
      {extras.length > 0 && (
        <table className="w-full text-sm">
          <caption className="mb-1 text-left font-semibold">{t('price.extras')}</caption>
          <tbody>
            {extras.map((p, i) => {
              const v = money(p.amount, p.currency);
              return (
                <tr key={i} className="border-b border-line/60">
                  <th scope="row" className="py-2 text-left font-normal">
                    {t(`price.cat.${p.category}`)}
                    {(p.season !== 'all' || p.dayType !== 'all' || windowLabel(p)) && (
                      <span className="text-muted"> · {[p.season !== 'all' && label(p.season), p.dayType !== 'all' && dayLabel(p.dayType), windowLabel(p)].filter(Boolean).join(', ')}</span>
                    )}
                    {p.note && <span className="block text-xs text-muted">{p.note}</span>}
                  </th>
                  <td className="py-2 text-right font-semibold tabular-nums" title={v.converted ? v.original : undefined}>
                    {v.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ReliabilityNote golf={golf} />
      {converted && rates?.date && (
        <p className="text-xs text-muted">
          {t('price.converted', { c: [...new Set(golf.prices.map((p) => p.currency))].join('/'), date: new Date(rates.date).toLocaleDateString(locale) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {golf.pricingUrl && (
          <a href={golf.pricingUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <ExternalLink className="size-4" aria-hidden /> {t('action.pricingPage')}
          </a>
        )}
        {golf.phone && golf.priceReliability !== 'verified' && (
          <a href={telHref(golf.phone)} className={buttonClass('secondary', 'sm')}>
            <Phone className="size-4" aria-hidden /> {t('action.callToAsk')}
          </a>
        )}
      </div>
    </div>
  );
}

function HoursSection({ golf }: { golf: GolfDetail }) {
  const { t, locale } = useI18n();
  const { playAt } = useSearch();
  const ready = useHoursLib();
  const oh = parseHours(golf.openingHours, golf.lat, golf.lon);
  if (golf.openingHours && !ready) return <div className="skeleton h-40 w-full" aria-hidden />;
  if (!oh) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-medium">
          <CircleHelp className="size-4" aria-hidden /> {t('hours.unknown')}
        </p>
        {golf.phone && (
          <a href={telHref(golf.phone)} className={buttonClass('primary', 'sm')}>
            <Phone className="size-4" aria-hidden /> {t('action.callToAsk')}
          </a>
        )}
      </div>
    );
  }
  const monday = weekStart(playAt);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <div className="space-y-3">
      <OpenStatus golf={golf} withDetail={false} />
      <table className="w-full text-sm">
        <caption className="sr-only">{t('hours.week', { date: monday.toLocaleDateString(locale) })}</caption>
        <tbody>
          {days.map((d) => {
            const list = intervalsOn(oh, d) ?? [];
            const isPlayDay = d.toDateString() === playAt.toDateString();
            return (
              <tr key={d.toISOString()} className={`border-b border-line/60 ${isPlayDay ? 'font-semibold' : ''}`} aria-current={isPlayDay ? 'date' : undefined}>
                <th scope="row" className="py-2 text-left font-normal capitalize">
                  {d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                </th>
                <td className="py-2 text-right tabular-nums">
                  {list.length ? formatIntervals(list, locale) : <span className="text-muted">{t('hours.closedAllDay')}</span>}
                  {list.some((i) => i.unknown) && <span className="text-muted"> ?</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted">
        {t('hours.localTime')} {t('hours.raw', { h: golf.openingHours ?? '' })}
      </p>
    </div>
  );
}

function ReviewsSection({ golf }: { golf: GolfDetail }) {
  const { t, tp, locale } = useI18n();
  const qc = useQueryClient();
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: () => api.addReview(golf.id, { author, rating, comment }),
    onSuccess: () => {
      setAuthor('');
      setRating(0);
      setComment('');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['golf', golf.id] });
      qc.invalidateQueries({ queryKey: ['golfs'] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (author.trim() && rating) m.mutate();
  };

  return (
    <div className="space-y-4">
      {golf.rating && (
        <p className="flex items-center gap-2">
          <Stars value={golf.rating.average} size="md" />
          <span className="text-2xl font-semibold tracking-tight">{golf.rating.average.toLocaleString(locale)}</span>
          <span className="sr-only">{t('reviews.average', { r: golf.rating.average })}</span>
          <span className="text-sm text-muted">({tp('card.reviews', golf.rating.count)})</span>
        </p>
      )}
      {golf.reviews.length === 0 && <p className="text-muted">{t('reviews.empty')}</p>}
      <ul className="space-y-3">
        {golf.reviews.map((r) => (
          <li key={r.id} className="frost rounded-[20px] p-3.5">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Stars value={r.rating} />
              <span className="sr-only">{tp('reviews.star', r.rating)}</span>
              <span className="font-semibold">{r.author}</span>
              <span className="text-muted">· {new Date(r.createdAt).toLocaleDateString(locale)}</span>
            </p>
            {r.comment && <p className="mt-1 text-sm whitespace-pre-line">{r.comment}</p>}
          </li>
        ))}
      </ul>
      {m.isSuccess && <Notice>{t('reviews.thanks')}</Notice>}
      {!open ? (
        <Button onClick={() => setOpen(true)}>{t('reviews.write')}</Button>
      ) : (
        <form onSubmit={submit} className="frost space-y-3 rounded-[24px] p-4">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t('reviews.rating')}</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
                  <span className="grid size-11 place-items-center rounded-full text-[28px] peer-focus-visible:ring-2 peer-focus-visible:ring-glacier-700">
                    <span aria-hidden className={n <= rating ? 'text-gold-600' : 'text-[rgba(15,26,36,0.18)] dark:text-white/20'}>★</span>
                    <span className="sr-only">{tp('reviews.star', n)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            {t('reviews.name')}
            <input required maxLength={60} value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1.5 h-12 w-full rounded-[16px] border border-line bg-white/70 px-3 text-base font-normal dark:bg-white/5" />
          </label>
          <label className="block text-sm font-semibold">
            {t('reviews.comment')}
            <textarea maxLength={2000} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1.5 w-full rounded-[16px] border border-line bg-white/70 px-3 py-2.5 text-base font-normal dark:bg-white/5" />
          </label>
          <p className="text-xs text-muted">{t('reviews.notice')}</p>
          {m.isError && <Notice tone="error">{t('reviews.error')}</Notice>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!author.trim() || !rating || m.isPending}>
              {t('reviews.submit')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function GolfPage() {
  const { id = '' } = useParams();
  const { t, lang, locale } = useI18n();
  const navigate = useNavigate();
  const { origin } = useSearch();
  const q = useQuery({ queryKey: ['golf', id], queryFn: () => api.golf(id), retry: (n, e) => n < 1 && (e as ApiError).status !== 404 });
  const session = useQuery({ queryKey: ['admin-session'], queryFn: api.admin.session, staleTime: 60_000, retry: false });

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  const back = (
    <button type="button" onClick={goBack} className="glass glass-interactive inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
      <ArrowLeft className="size-4" aria-hidden /> {t('detail.back')}
    </button>
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 overflow-y-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" aria-busy="true">
        {back}
        <div className="skeleton aspect-[16/10] w-full rounded-[28px]" />
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-40 w-full rounded-[28px]" />
      </div>
    );
  }
  if (q.error || !q.data) {
    const notFound = (q.error as ApiError)?.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        {back}
        <Notice tone="error" action={!notFound && <Button size="sm" onClick={() => q.refetch()}>{t('results.retry')}</Button>}>
          {notFound ? t('detail.notFound') : t('detail.loadError')}
        </Notice>
      </div>
    );
  }

  const g = q.data;
  const name = golfName(g, t('card.unnamed'));
  const desc = g.description[lang] ?? g.description.fr ?? g.description.en ?? g.description.es;
  const dist = origin ? Math.round(haversineKm(origin.lat, origin.lon, g.lat, g.lon) * 10) / 10 : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <article className="mx-auto w-full max-w-3xl space-y-4 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-16 sm:px-4" aria-labelledby="golf-title">
        <div className="relative">
          <GolfPhoto
            src={g.photos[0] ?? null}
            alt={t('detail.photoOf', { name })}
            className="aspect-[16/10] w-full rounded-[28px] sm:aspect-[16/8]"
            style={{ viewTransitionName: vtName(g.id) }}
          />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <GlassButton round onClick={goBack} aria-label={t('detail.back')}>
              <ArrowLeft className="size-5" aria-hidden />
            </GlassButton>
            <div className="flex gap-2">
              <ShareButton golf={g} variant="icon" />
              <FavoriteButton golf={g} />
            </div>
          </div>
        </div>

        <GlassCard strong className="relative mx-2 -mt-14 space-y-2.5 p-5 sm:mx-6">
          <div className="flex flex-wrap gap-1.5">
            {g.isDemo && <Badge tone="demo">{t('demo.notice')}</Badge>}
            {g.holes && <Badge>{t('card.holes', { n: g.holes })}</Badge>}
            {g.par && <Badge>{t('card.par', { n: g.par })}</Badge>}
          </div>
          <h1 id="golf-title" className="text-[30px] leading-[1.1] [overflow-wrap:anywhere] sm:text-4xl">
            {name}
          </h1>
          {(g.address || dist !== null) && (
            <p className="flex items-start gap-1.5 text-[15px] text-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {g.address}
                {g.address && dist !== null && ' · '}
                {dist !== null && t('detail.away', { d: dist.toLocaleString(locale) })}
              </span>
            </p>
          )}
          <OpenStatus golf={g} />
        </GlassCard>

        {g.photos.length > 1 && (
          <ul aria-label={t('detail.photos')} className="no-scrollbar flex gap-2 overflow-x-auto">
            {g.photos.slice(1).map((p, i) => (
              <li key={p} className="shrink-0">
                <a href={p} target="_blank" rel="noopener noreferrer">
                  <img src={p} alt={`${t('detail.photoOf', { name })} (${i + 2})`} loading="lazy" className="aspect-[3/2] h-24 rounded-[20px] object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <Link to={`/inviter/${encodeURIComponent(g.id)}`} viewTransition className={cx(buttonClass('primary'), 'h-14 w-full text-base')}>
          <Flag className="size-5" aria-hidden /> {t('detail.organize')}
        </Link>
        <GolfActions golf={g} size="md" />
        <p className="px-1 text-sm text-muted">
          {t('action.directions')}
          {lang === 'fr' ? ' : ' : ': '}
          <a className="underline underline-offset-2" href={googleDirections(g.lat, g.lon)} target="_blank" rel="noopener noreferrer">
            {t('directions.google')}
          </a>{' '}
          ·{' '}
          <a className="underline underline-offset-2" href={appleDirections(g.lat, g.lon, g.name)} target="_blank" rel="noopener noreferrer">
            {t('directions.apple')}
          </a>
        </p>

        {desc && (
          <Section title={t('detail.description')} id="s-desc">
            <p className="leading-relaxed whitespace-pre-line">{desc}</p>
          </Section>
        )}

        <Section title={t('detail.prices')} id="s-prices">
          <PricesSection golf={g} />
        </Section>

        <Section title={t('detail.hours')} id="s-hours">
          <HoursSection golf={g} />
        </Section>

        <Section title={t('detail.courses')} id="s-courses">
          {g.courses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th scope="col" className="py-1.5 font-normal">{t('detail.course')}</th>
                    <th scope="col" className="py-1.5 text-right font-normal">{t('detail.holes')}</th>
                    <th scope="col" className="py-1.5 text-right font-normal">{t('detail.par')}</th>
                    <th scope="col" className="py-1.5 text-right font-normal">{t('detail.length')}</th>
                    <th scope="col" className="py-1.5 text-right font-normal">{t('detail.difficulty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.courses.map((c, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <th scope="row" className="py-2 text-left font-medium">{c.name || '—'}</th>
                      <td className="py-2 text-right tabular-nums">{c.holes ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums">{c.par ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums">{c.lengthM ? `${c.lengthM.toLocaleString(locale)} m` : '—'}</td>
                      <td className="py-2 text-right">{c.difficulty ? t(`difficulty.${c.difficulty}`) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">{t('detail.noCourses')}</p>
          )}
        </Section>

        <Section title={t('detail.services')} id="s-services">
          {SERVICE_KEYS.every((k) => g.services[k] == null) ? (
            <p className="text-muted">{t('detail.noServices')}</p>
          ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICE_KEYS.map((k) => {
              const v = g.services[k];
              return (
                <li key={k} className="flex items-center gap-2 text-sm">
                  {v === true ? (
                    <Check className="size-4 text-fairway-600 dark:text-fairway-300" aria-hidden />
                  ) : v === false ? (
                    <X className="size-4 text-red-700 dark:text-red-300" aria-hidden />
                  ) : (
                    <CircleHelp className="size-4 text-muted" aria-hidden />
                  )}
                  <span className={v == null ? 'text-muted' : ''}>{t(`service.${k}`)}</span>
                  <span className="sr-only">: {v === true ? t('service.yes') : v === false ? t('service.no') : t('service.unknown')}</span>
                  {v == null && <span className="text-xs text-muted" aria-hidden>({t('service.unknown')})</span>}
                </li>
              );
            })}
          </ul>
          )}
        </Section>

        <Section title={t('detail.contact')} id="s-contact">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{t('detail.address')}</dt>
            <dd>{g.address ?? t('common.unknown')}</dd>
            <dt className="text-muted">{t('detail.phone')}</dt>
            <dd>
              {g.phone ? (
                <a href={telHref(g.phone)} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                  <Phone className="size-3.5" aria-hidden />
                  {g.phone}
                </a>
              ) : (
                t('common.unknown')
              )}
            </dd>
            <dt className="text-muted">{t('detail.email')}</dt>
            <dd>
              {g.email ? (
                <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                  <Mail className="size-3.5" aria-hidden />
                  {g.email}
                </a>
              ) : (
                t('common.unknown')
              )}
            </dd>
            <dt className="text-muted">{t('detail.website')}</dt>
            <dd>
              {g.website ? (
                <a href={g.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {displayHost(g.website)}
                </a>
              ) : (
                t('common.unknown')
              )}
            </dd>
          </dl>
        </Section>

        <Section title={t('detail.reviews')} id="s-reviews">
          <ReviewsSection golf={g} />
        </Section>

        <footer className="space-y-2 text-xs text-muted">
          {g.osmUrl && (
            <p>
              {t('detail.source')} ·{' '}
              <a href={g.osmUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {t('detail.viewOsm')}
              </a>
            </p>
          )}
          {session.data?.admin && (
            <Link to={`/admin/golf/${encodeURIComponent(g.id)}`} className={buttonClass('secondary', 'sm')}>
              <Pencil className="size-4" aria-hidden /> {t('detail.edit')}
            </Link>
          )}
        </footer>
      </article>
    </div>
  );
}

