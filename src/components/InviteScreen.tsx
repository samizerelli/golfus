import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookUser, Check, Copy, ExternalLink, Mail, MessageCircle, Navigation, Plus, Search, Send, Smartphone, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Link, useNavigate } from 'react-router-dom';
import type { GolfSummary } from '../../shared/types';
import { useI18n } from '../i18n';
import { api, type Outing } from '../lib/api';
import { useAuth } from '../lib/auth';
import { canPickContact, guestFromInput, mailLink, phoneDigits, pickContact, smsLink, whatsappLink, type ExternalGuest } from '../lib/contacts';
import { isNative } from '../lib/platform';
import { directionsUrl } from '../lib/links';
import L from '../lib/leafletGlobal';
import { pricePerPerson } from '../lib/criteria';
import { useSettings } from '../lib/settings';
import { useSearch } from '../state/search';
import { Avatar } from './AccountPanel';
import { BookingButton, CheaperLater } from './BookingButton';
import { useRail } from './ActionRail';
import { APP_STORE_URL, shareUrl } from './RailPanels';
import { PricePerPerson, RatingLine } from './ResultsList';
import { buttonClass, Button, cx, haptic, Notice } from './ui';
import { errorMessage } from './Moderation';

/** Golf de l'écran 3 : depuis les résultats déjà chargés, sinon depuis sa fiche. */
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
      {!compact && (
      <div className="glass glass-rounded space-y-3 p-3">
        <MiniMap golf={golf} />
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{golf.name || t('card.unnamed')}</p>
          <a href={directionsUrl(golf.lat, golf.lon, golf.name)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <Navigation className="size-4" aria-hidden /> {t('action.directions')}
          </a>
        </div>
      </div>
      )}
      <div className="glass glass-rounded p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-medium text-muted">{t('s3.pricePerPerson')}</span>
          <PricePerPerson golf={golf} criteria={criteria} large={!compact} />
        </div>
        {total && <p className="mt-1 text-right text-xs text-muted">{t('s3.total', { p: total, n: criteria.players })}</p>}
        <CheaperLater golf={golf} className="mt-1 text-right text-xs" />
      </div>
      <div className="glass glass-rounded flex items-center justify-between gap-3 p-4">
        <span className="shrink-0 text-sm font-medium whitespace-nowrap text-muted">{t('s3.rating')}</span>
        <RatingLine golf={golf} size={compact ? 'sm' : 'md'} />
      </div>
      <div className="flex flex-wrap gap-2">
        <BookingButton golf={golf} size="md" />
        {compact && (
          <a href={directionsUrl(golf.lat, golf.lon, golf.name)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
            <Navigation className="size-4" aria-hidden /> {t('action.directions')}
          </a>
        )}
        <Link to={`/golf/${encodeURIComponent(golf.id)}`} viewTransition className={buttonClass('secondary', 'md')}>
          <ExternalLink className="size-4" aria-hidden /> {t('s3.details')}
        </Link>
      </div>
    </div>
  );
}

function Sent({ outing, guests, matched, onHome }: { outing: Outing; guests: ExternalGuest[]; matched: string[]; onHome: () => void }) {
  const { t } = useI18n();
  const { setOpen } = useRail();
  const [copied, setCopied] = useState(false);
  const url = outing.shareToken ? shareUrl(outing.shareToken) : '';
  // Texte complet envoyé : message de la partie, lien pour répondre (page dans la langue de l'invité) et lien App Store
  const text = t('s3.shareText', { message: outing.message ?? outing.golf.name, url, app: APP_STORE_URL });
  const subject = t('s3.mailSubject', { golf: outing.golf.name });
  // Invités à prévenir soi-même (ceux qui ont un compte GolfUs ont déjà reçu la notification dans l'app)
  const toSend = guests.filter((g) => !(g.email && matched.includes(g.email)));
  // Un seul invité avec un numéro, dans l'app iPhone : WhatsApp s'ouvre directement sur sa conversation, message prêt
  useEffect(() => {
    if (!isNative() || toSend.length !== 1 || !phoneDigits(toSend[0].phone) || !url) return;
    window.location.href = whatsappLink(toSend[0].phone, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="animate-rise space-y-4 py-2 text-center" role="status">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-fairway-700 text-white shadow-[0_8px_24px_rgba(31,93,74,0.35)] dark:bg-fairway-300 dark:text-fairway-950">
        <Check className="size-8" aria-hidden />
      </span>
      {/* Aucun ami joint à la partie : rien n'a été envoyé tant que le lien n'est pas partagé */}
      <h2 className="text-2xl">{outing.guests.length > 0 ? t('s3.sentTitle') : t('s3.createdTitle')}</h2>
      <p className="text-sm text-muted">{toSend.length > 0 ? t('s3.sendEachBody') : outing.guests.length > 0 ? t('s3.sentBody') : t('s3.createdBody')}</p>
      {/* Chaque invité hors de l'app : WhatsApp (sa conversation), SMS ou e-mail, avec le message prêt à envoyer */}
      {url && guests.length > 0 && (
        <ul className="space-y-2 text-left">
          {guests.map((g) => (
            <li key={g.key} className="frost space-y-2 rounded-[22px] p-3.5">
              <p className="font-semibold [overflow-wrap:anywhere]">{g.name}</p>
              {g.email && matched.includes(g.email) ? (
                <p className="flex items-center gap-1.5 text-sm text-fairway-700 dark:text-fairway-300">
                  <Check className="size-4" aria-hidden /> {t('s3.notifiedInApp')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <a href={whatsappLink(g.phone, text)} target="_blank" rel="noopener noreferrer" className={buttonClass(phoneDigits(g.phone) ? 'primary' : 'secondary', 'sm')}>
                    <MessageCircle className="size-4" aria-hidden /> {t('s3.whatsapp')}
                  </a>
                  {g.phone && (
                    <a href={smsLink(g.phone, text)} className={buttonClass('secondary', 'sm')}>
                      <Smartphone className="size-4" aria-hidden /> {t('s3.sms')}
                    </a>
                  )}
                  {g.email && (
                    <a href={mailLink(g.email, subject, text)} className={buttonClass('secondary', 'sm')}>
                      <Mail className="size-4" aria-hidden /> {t('s3.email')}
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Lien toujours proposé : pour toute autre personne (groupe WhatsApp, autre messagerie) */}
      {url && (
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
                await navigator.clipboard.writeText(text).catch(() => undefined);
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
/** `top` : contenu affiché sous l'en-tête (fiches du golf sur mobile). */
export function InviteForm({ golf, top }: { golf: GolfSummary | null; top?: ReactNode }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { criteria: c } = useSearch();
  const { setOpen } = useRail();
  const friends = useQuery({ queryKey: ['friends'], queryFn: api.friends, enabled: !!user });
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Invités hors de l'app : nom / numéro / e-mail saisi, ou contact du téléphone
  const [guests, setGuests] = useState<ExternalGuest[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const addGuest = (g: ExternalGuest | null) => {
    if (!g) return;
    haptic();
    setGuests((list) => (list.some((x) => x.key === g.key) ? list : [...list, g]));
    setGuestInput('');
  };
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
        emails: guests.map((g) => g.email).filter((e): e is string => !!e),
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
        guests={guests}
        matched={send.data.matchedEmails ?? []}
        onHome={() => {
          navigate('/');
          setOpen('outings');
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
  const canSend = !!golf && !send.isPending;

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
        {top}

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
              {/* Demandes d'ami pas encore acceptées : ces joueurs ne peuvent pas être invités, on le dit */}
              {!!friends.data?.outgoing.length && (
                <p className="frost rounded-[18px] px-3.5 py-2.5 text-sm text-muted">
                  {t('s3.pendingFriends', { names: friends.data.outgoing.map((f) => f.name ?? '—').join(', ') })}
                </p>
              )}
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

            {/* Autres invités : nom, numéro ou e-mail tapé, ou contact choisi dans le téléphone */}
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t('s3.external')}</h2>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addGuest(guestFromInput(guestInput));
                }}
              >
                <label className="frost flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full px-4">
                  <UserPlus className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="sr-only">{t('s3.guestPlaceholder')}</span>
                  <input
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value)}
                    placeholder={t('s3.guestPlaceholder')}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-base focus:outline-none"
                  />
                </label>
                <Button type="submit" disabled={!guestInput.trim()} aria-label={t('s3.add')} className="h-12 shrink-0 px-4">
                  <Plus className="size-5" aria-hidden />
                </Button>
              </form>
              {canPickContact() && (
                <Button className="w-full" onClick={async () => addGuest(await pickContact())}>
                  <BookUser className="size-4" aria-hidden /> {t('s3.contacts')}
                </Button>
              )}
              {guests.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {guests.map((g) => (
                    <li key={g.key} className="frost flex h-9 items-center gap-1 rounded-full pr-1 pl-3 text-sm font-medium">
                      <span className="max-w-[12rem] truncate">{g.name}</span>
                      {g.phone && <Smartphone className="size-3.5 text-muted" aria-hidden />}
                      {g.email && <Mail className="size-3.5 text-muted" aria-hidden />}
                      <button
                        type="button"
                        onClick={() => setGuests((list) => list.filter((x) => x.key !== g.key))}
                        className="grid size-7 place-items-center rounded-full hover:bg-card-2"
                        aria-label={t('s3.remove', { name: g.name })}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">{t('s3.externalHint')}</p>
            </section>

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
            {send.isError && <Notice tone="error">{errorMessage(send.error, t, 's3.error')}</Notice>}
          </>
        )}
      </div>

      {user && (
        <div className="sticky bottom-[calc(-5.5rem-env(safe-area-inset-bottom))] -mx-3 mt-auto lg:bottom-0 -mb-[calc(5.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--surface)] from-70% to-transparent px-3 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:-mx-1 lg:mb-0 lg:px-1 lg:pb-1">
          <Button type="button" variant="primary" disabled={!canSend} onClick={() => send.mutate()} className="h-14 w-full text-base">
            <Send className="size-5" aria-hidden />
            {t('s3.send')}
            {selected.size + guests.length > 0 && ` (${selected.size + guests.length})`}
          </Button>
          {/* Pourquoi le bouton est grisé */}
          {!canSend && !send.isPending && golf && <p className="mt-2 text-center text-xs text-muted">{t('s3.sendHint')}</p>}
        </div>
      )}
    </div>
  );
}
