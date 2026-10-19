import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, ExternalLink, Link2, MessageCircle, Navigation, Search, Send, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { GolfSummary } from '../../shared/types';
import { useI18n } from '../i18n';
import { api, type Outing } from '../lib/api';
import { useAuth } from '../lib/auth';
import { directionsUrl } from '../lib/links';
import L from '../lib/leafletGlobal';
import { pricePerPerson } from '../lib/criteria';
import { useResults } from '../lib/useResults';
import { useSettings } from '../lib/settings';
import { useSearch } from '../state/search';
import { Avatar } from './AccountPanel';
import { BookingButton } from './BookingButton';
import { useRail } from './ActionRail';
import { shareUrl } from './RailPanels';
import { PricePerPerson, RatingLine } from './ResultsList';
import { buttonClass, Button, cx, haptic, Notice } from './ui';

/** Golf de l'écran 3 : depuis les résultats déjà chargés, sinon depuis sa fiche. */
export function useInviteGolf(): { golf: GolfSummary | null; loading: boolean } {
  const { id = '' } = useParams();
  const { all } = useResults();
  const fromList = all.find((g) => g.id === id) ?? null;
  const q = useQuery({ queryKey: ['golf', id], queryFn: () => api.golf(id), enabled: !!id && !fromList, staleTime: 10 * 60_000 });
  return { golf: fromList ?? q.data ?? null, loading: !fromList && q.isLoading };
}

const pin = (label: string) =>
  L.divIcon({ className: 'price-marker', iconSize: [0, 0], iconAnchor: [0, 0], html: `<div class="price-pill is-selected">${label.replace(/[&<>"]/g, '')}</div>` });

function MiniMap({ golf }: { golf: GolfSummary }) {
  return (
    <div className="h-40 overflow-hidden rounded-[20px]" aria-hidden>
      <MapContainer
        key={golf.id}
        center={[golf.lat, golf.lon]}
        zoom={13}
        className="size-full"
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles" />
        <Marker position={[golf.lat, golf.lon]} icon={pin('⛳')} interactive={false} />
      </MapContainer>
    </div>
  );
}

/** Colonne d'informations du golf (en haut à droite sur ordinateur, en tête du tiroir sur mobile). */
export function GolfSideCards({ golf, compact = false }: { golf: GolfSummary; compact?: boolean }) {
  const { t } = useI18n();
  const { criteria } = useSearch();
  const { money } = useSettings();
  const pp = pricePerPerson(golf, criteria);
  const total = pp && criteria.players > 1 ? money(pp.amount * criteria.players, pp.currency).text : null;
  return (
    <div className="space-y-3">
      <div className="glass glass-rounded space-y-3 p-3">
        {!compact && <MiniMap golf={golf} />}
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{golf.name || t('card.unnamed')}</p>
          <a href={directionsUrl(golf.lat, golf.lon, golf.name)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <Navigation className="size-4" aria-hidden /> {t('action.directions')}
          </a>
        </div>
      </div>
      <div className="glass glass-rounded p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-medium text-muted">{t('s3.pricePerPerson')}</span>
          <PricePerPerson golf={golf} criteria={criteria} large={!compact} />
        </div>
        {total && <p className="mt-1 text-right text-xs text-muted">{t('s3.total', { p: total, n: criteria.players })}</p>}
      </div>
      <div className="glass glass-rounded flex items-center justify-between gap-3 p-4">
        <span className="shrink-0 text-sm font-medium whitespace-nowrap text-muted">{t('s3.rating')}</span>
        <RatingLine golf={golf} size={compact ? 'sm' : 'md'} />
      </div>
      <div className="flex flex-wrap gap-2">
        <BookingButton golf={golf} size="md" />
        <Link to={`/golf/${encodeURIComponent(golf.id)}`} viewTransition className={buttonClass('secondary', 'md')}>
          <ExternalLink className="size-4" aria-hidden /> {t('s3.details')}
        </Link>
      </div>
    </div>
  );
}

function Sent({ outing, external, onHome }: { outing: Outing; external: boolean; onHome: () => void }) {
  const { t } = useI18n();
  const { setOpen } = useRail();
  const [copied, setCopied] = useState(false);
  const url = outing.shareToken ? shareUrl(outing.shareToken) : '';
  const text = `${outing.message ?? outing.golf.name}\n${url}`;
  return (
    <div className="animate-rise space-y-4 py-2 text-center" role="status">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-fairway-700 text-white shadow-[0_8px_24px_rgba(31,93,74,0.35)] dark:bg-fairway-300 dark:text-fairway-950">
        <Check className="size-8" aria-hidden />
      </span>
      <h2 className="text-2xl">{t('s3.sentTitle')}</h2>
      {outing.guests.length > 0 && <p className="text-sm text-muted">{t('s3.sentBody')}</p>}
      {external && url && (
        <div className="frost space-y-2 rounded-[22px] p-4 text-left">
          <p className="text-sm font-medium">{t('s3.shareTitle')}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
              <MessageCircle className="size-4" aria-hidden /> {t('s3.whatsapp')}
            </a>
            <a href={`sms:?&body=${encodeURIComponent(text)}`} className={buttonClass('secondary', 'sm')}>
              <Smartphone className="size-4" aria-hidden /> {t('s3.sms')}
            </a>
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => undefined);
                setCopied(true);
              }}
            >
              <Copy className="size-4" aria-hidden /> {copied ? t('s3.copied') : t('s3.copy')}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={onHome}>
          {t('s3.home')}
        </Button>
        <Button onClick={() => setOpen('outings')}>{t('s3.myOutings')}</Button>
      </div>
    </div>
  );
}

/** Écran 3 : inviter des amis (panneau de gauche / tiroir). */
export function InviteForm({ golf }: { golf: GolfSummary | null }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { criteria: c, setView } = useSearch();
  const friends = useQuery({ queryKey: ['friends'], queryFn: api.friends, enabled: !!user });
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [external, setExternal] = useState(false);
  const niceDate = new Date(`${c.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const defaultMessage = useMemo(
    () =>
      golf
        ? t('s3.defaultMessage', {
            golf: golf.name,
            date: niceDate,
            from: c.timeFrom,
            to: c.timeTo,
            holes: c.holes === '9' ? t('s3.holes9') : c.holes === '18' ? t('s3.holes18') : '',
            players: c.players,
          })
        : '',
    [golf, t, niceDate, c],
  );
  const [message, setMessage] = useState(defaultMessage);
  useEffect(() => setMessage(defaultMessage), [defaultMessage]);

  const send = useMutation({
    mutationFn: () =>
      api.createOuting({
        golfId: golf!.id,
        golfName: golf!.name || t('card.unnamed'),
        golfLat: golf!.lat,
        golfLon: golf!.lon,
        date: c.date,
        timeFrom: c.timeFrom,
        timeTo: c.timeTo,
        holes: c.holes === 'any' ? null : (Number(c.holes) as 9 | 18),
        players: c.players,
        message: message.trim() || null,
        friendIds: [...selected],
      }),
    onSuccess: () => {
      haptic(20);
      qc.invalidateQueries({ queryKey: ['outings'] });
    },
  });

  const back = (
    <button
      type="button"
      onClick={() => {
        setView('results');
        navigate('/', { viewTransition: true });
      }}
      className="glass glass-interactive grid size-11 shrink-0 place-items-center rounded-full"
      aria-label={t('detail.back')}
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );

  if (send.data)
    return (
      <Sent
        outing={send.data}
        external={external}
        onHome={() => {
          setView('search');
          navigate('/');
        }}
      />
    );

  const list = (friends.data?.friends ?? []).filter((f) => (f.name ?? '').toLowerCase().includes(filter.trim().toLowerCase()));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      haptic();
      return n;
    });
  const canSend = !!golf && (selected.size > 0 || external) && !send.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-2">
          {back}
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight">{t('s3.title')}</h1>
            {golf && <p className="truncate text-sm text-muted">{golf.name}</p>}
          </div>
        </div>

        {!user ? (
          <div className="frost space-y-3 rounded-[22px] p-4">
            <p className="text-sm">{t('s3.loginNeeded')}</p>
            <Link to="/connexion" className={buttonClass('primary') + ' w-full'}>
              {t('auth.cta')}
            </Link>
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t('s3.friends')}</h2>
              <label className="frost flex h-12 items-center gap-2 rounded-full px-4">
                <Search className="size-4 text-muted" aria-hidden />
                <span className="sr-only">{t('s3.searchFriends')}</span>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('s3.searchFriends')} className="min-w-0 flex-1 bg-transparent text-base focus:outline-none" />
              </label>
              {friends.isLoading && <div className="skeleton h-14 w-full rounded-[20px]" aria-hidden />}
              {friends.data && friends.data.friends.length === 0 && <p className="text-sm text-muted">{t('s3.noFriends')}</p>}
              <ul className="space-y-2">
                {list.map((f) => {
                  const on = selected.has(f.id);
                  return (
                    <li key={f.id}>
                      <label className={cx('frost flex min-h-14 cursor-pointer items-center gap-3 rounded-[20px] p-2.5 pr-3 transition-shadow', on && 'shadow-[0_0_0_2px_#1f5d4a]')}>
                        <Avatar src={f.image} name={f.name} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{f.name}</span>
                          {f.handicapIndex != null && <span className="block text-xs text-muted">{t('fr.hcp', { h: f.handicapIndex })}</span>}
                        </span>
                        <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="peer sr-only" />
                        <span
                          className={cx(
                            'grid size-7 place-items-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-glacier-700',
                            on ? 'border-fairway-700 bg-fairway-700 text-white' : 'border-[var(--line)]',
                          )}
                          aria-hidden
                        >
                          {on && <Check className="size-4" />}
                        </span>
                        <span className="sr-only">{on ? t('s3.selected') : t('s3.select')}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <label className="frost flex min-h-14 cursor-pointer items-start gap-3 rounded-[20px] p-3">
              <Link2 className="mt-0.5 size-5 shrink-0 text-glacier-700 dark:text-glacier-300" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{t('s3.external')}</span>
                <span className="block text-xs text-muted">{t('s3.externalHint')}</span>
              </span>
              <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} className="mt-1 size-6 accent-fairway-700" />
            </label>

            <label className="block text-[13px] font-semibold tracking-wide text-muted uppercase">
              {t('s3.message')}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                className="frost mt-1.5 w-full rounded-[16px] px-4 py-3 text-base font-normal tracking-normal text-ink normal-case"
              />
            </label>
            {send.isError && <Notice tone="error">{t('s3.error')}</Notice>}
          </>
        )}
      </div>

      {user && (
        <div className="sticky bottom-[calc(-5.5rem-env(safe-area-inset-bottom))] -mx-3 mt-auto lg:bottom-0 -mb-[calc(5.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--surface)] from-70% to-transparent px-3 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:-mx-1 lg:mb-0 lg:px-1 lg:pb-1">
          <Button type="button" variant="primary" disabled={!canSend} onClick={() => send.mutate()} className="h-14 w-full text-base">
            <Send className="size-5" aria-hidden />
            {t('s3.send')}
            {selected.size > 0 && ` (${selected.size})`}
          </Button>
        </div>
      )}
    </div>
  );
}
