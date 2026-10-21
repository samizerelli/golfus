import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ChevronRight, FileText, Lock, Search, Share2, ShieldCheck, UserPlus, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isNative, PUBLIC_ORIGIN } from '../lib/platform';
import { shareLink } from '../lib/share';
import { enablePush, pushState, type PushState } from '../lib/push';
import { CURRENCIES, type Currency } from '../../shared/types';
import { LANGS, useI18n } from '../i18n';
import { api, type Notification, type Outing } from '../lib/api';
import { useFavorites } from '../lib/favorites';
import { useSettings, type Theme } from '../lib/settings';
import { AccountPanel, Avatar } from './AccountPanel';
import { GolfPhoto } from './GolfBits';
import { Badge, Button, cx, haptic, Notice, Segmented } from './ui';
import { useRail } from './ActionRail';
import { todayStr } from '../state/search';
import { ReportButton } from './Moderation';

const row = 'frost flex items-center gap-3 rounded-[20px] p-2.5 pr-3';

export function AccountBody({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <AccountPanel />
      <Link to="/profil" onClick={onNavigate} className="flex h-11 items-center justify-end gap-1 text-sm font-medium text-link">
        {t('nav.profile')} <ChevronRight className="size-4" aria-hidden />
      </Link>
    </>
  );
}

export function FavoritesBody({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n();
  const { favorites, toggle } = useFavorites();
  if (!favorites.length) return <p className="text-sm text-muted">{t('fav.empty')}</p>;
  return (
    <ul className="space-y-2">
      {favorites.map((f) => (
        <li key={f.id} className={row}>
          <GolfPhoto src={f.photo} alt="" className="size-12 shrink-0 rounded-[14px]" />
          <Link to={`/golf/${encodeURIComponent(f.id)}`} onClick={onNavigate} className="min-w-0 flex-1 truncate font-semibold hover:underline">
            {f.name || t('card.unnamed')}
          </Link>
          <button type="button" onClick={() => toggle(f)} className="grid size-11 place-items-center rounded-full hover:bg-card-2" aria-label={`${t('action.unfavorite')} : ${f.name}`}>
            <X className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

const RESP_TONE = { yes: 'green', maybe: 'gold', no: 'red', pending: 'neutral' } as const;

export function shareUrl(token: string) {
  return `${PUBLIC_ORIGIN}/invitation/${token}`;
}

function OutingCard({ o }: { o: Outing }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const respond = useMutation({ mutationFn: (r: 'yes' | 'maybe' | 'no') => api.respondOuting(o.id, r), onSuccess: () => qc.invalidateQueries({ queryKey: ['outings'] }) });
  const cancel = useMutation({ mutationFn: () => api.cancelOuting(o.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['outings'] }) });
  const date = new Date(`${o.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const label = (r: string) => t(`out.${r}` as 'out.yes');
  const active = o.status === 'active' && o.date >= todayStr();
  return (
    <li className={cx('frost space-y-2 rounded-[22px] p-4', !active && 'opacity-75')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{o.golf.name}</p>
          <p className="text-sm text-muted tabular-nums">
            {date} · {o.timeFrom}–{o.timeTo}
            {o.holes ? ` · ${t('card.holes', { n: o.holes })}` : ''} · {o.players} {t('s1.players').toLowerCase()}
          </p>
          <p className="text-xs text-muted">{o.isOrganizer ? t('out.mine') : t('out.by', { name: o.organizer.name ?? '—' })}</p>
        </div>
        {o.status === 'cancelled' ? <Badge tone="red">{t('out.cancelled')}</Badge> : !active && <Badge>{t('out.past')}</Badge>}
      </div>
      {o.message && <p className="text-sm whitespace-pre-line">{o.message}</p>}
      <ul className="flex flex-wrap gap-1.5">
        {o.guests.map((g, i) => (
          <li key={g.id ?? i}>
            <Badge tone={RESP_TONE[g.response]}>
              {g.name ?? '—'} · {label(g.response)}
            </Badge>
          </li>
        ))}
      </ul>
      {!o.isOrganizer && active && (
        <div role="group" aria-label={t('out.answer')} className="flex flex-wrap gap-2">
          {(['yes', 'maybe', 'no'] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={o.myResponse === r}
              onClick={() => respond.mutate(r)}
              className={cx(
                'h-11 rounded-full border px-4 text-sm font-semibold',
                o.myResponse === r ? 'border-fairway-700 bg-fairway-700 text-white dark:bg-fairway-300 dark:text-fairway-950' : 'frost',
              )}
            >
              {label(r)}
            </button>
          ))}
        </div>
      )}
      {o.isOrganizer && active && (
        <div className="flex flex-wrap gap-2">
          {o.shareToken && (
            <Button
              size="sm"
              onClick={async () => {
                const url = shareUrl(o.shareToken!);
                if ((await shareLink({ title: o.golf.name, url })) === 'unsupported') await navigator.clipboard.writeText(url).catch(() => undefined);
              }}
            >
              <Share2 className="size-4" aria-hidden /> {t('out.share')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => confirm(t('out.cancel') + ' ?') && cancel.mutate()}>
            {t('out.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}

export function OutingsBody() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['outings'], queryFn: api.outings });
  if (q.isLoading) return <div className="skeleton h-28 w-full rounded-[22px]" aria-hidden />;
  if (!q.data?.length) return <p className="text-sm text-muted">{t('out.empty')}</p>;
  const today = todayStr();
  const key = (o: Outing) => o.date + o.timeFrom;
  const upcoming = q.data.filter((o) => o.date >= today).sort((a, b) => key(a).localeCompare(key(b)));
  const past = q.data.filter((o) => o.date < today).sort((a, b) => key(b).localeCompare(key(a)));
  return (
    <>
      {upcoming.length > 0 && (
        <ul className="space-y-3">
          {upcoming.map((o) => (
            <OutingCard key={o.id} o={o} />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t('out.pastTitle')}</h3>
          <ul className="space-y-3">
            {past.map((o) => (
              <OutingCard key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function FriendsBody() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const friends = useQuery({ queryKey: ['friends'], queryFn: api.friends });
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const results = useQuery({ queryKey: ['user-search', debounced], queryFn: () => api.searchUsers(debounced), enabled: debounced.length >= 3 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['friends'] });
  const ask = useMutation({ mutationFn: api.requestFriend, onSuccess: refresh });
  const accept = useMutation({ mutationFn: api.acceptFriend, onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.removeFriend, onSuccess: refresh });
  const known = new Set([...(friends.data?.friends ?? []), ...(friends.data?.outgoing ?? []), ...(friends.data?.incoming ?? [])].map((f) => f.id));
  const hcp = (h: number | null) => (h != null ? t('fr.hcp', { h }) : '');

  return (
    <>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('fr.add')}</h3>
        <label className="frost flex h-12 items-center gap-2 rounded-full px-4">
          <Search className="size-4 text-muted" aria-hidden />
          <span className="sr-only">{t('fr.add')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('fr.searchHint')} className="min-w-0 flex-1 bg-transparent text-base focus:outline-none" />
        </label>
        {debounced.length >= 3 && results.data?.length === 0 && <p className="text-sm text-muted">{t('fr.noResult')}</p>}
        <ul className="space-y-2">
          {results.data?.map((u) => (
            <li key={u.id} className={row}>
              <Avatar src={u.image} name={u.name} size={40} />
              <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
              {known.has(u.id) || ask.variables === u.id ? (
                <span className="text-xs text-muted">{t('fr.sent')}</span>
              ) : (
                <Button size="sm" onClick={() => ask.mutate(u.id)}>
                  <UserPlus className="size-4" aria-hidden /> {t('fr.ask')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {!!friends.data?.incoming.length && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t('fr.requests')}</h3>
          <ul className="space-y-2">
            {friends.data.incoming.map((f) => (
              <li key={f.id} className={row}>
                <Avatar src={f.image} name={f.name} size={40} />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <Button size="sm" variant="primary" onClick={() => accept.mutate(f.id)}>
                  <Check className="size-4" aria-hidden /> {t('fr.accept')}
                </Button>
                <button type="button" onClick={() => remove.mutate(f.id)} className="grid size-11 place-items-center rounded-full hover:bg-card-2" aria-label={t('fr.decline')}>
                  <X className="size-4" aria-hidden />
                </button>
                <BlockButton id={f.id} name={f.name} onDone={refresh} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t('fr.title')}</h3>
        {friends.isLoading && <div className="skeleton h-14 w-full rounded-[20px]" aria-hidden />}
        {friends.data?.friends.length === 0 && <p className="text-sm text-muted">{t('fr.none')}</p>}
        <ul className="space-y-2">
          {friends.data?.friends.map((f) => (
            <li key={f.id} className={row}>
              <Avatar src={f.image} name={f.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="block text-xs text-muted">{hcp(f.handicapIndex)}</span>
              </span>
              <button type="button" onClick={() => confirm(`${t('fr.remove')} ${f.name} ?`) && remove.mutate(f.id)} className="h-11 px-2 text-xs text-muted hover:text-ink">
                {t('fr.remove')}
              </button>
              <ReportButton kind="user" targetId={f.id} className="px-1" />
              <BlockButton id={f.id} name={f.name} onDone={refresh} />
            </li>
          ))}
        </ul>
      </section>

      {!!friends.data?.outgoing.length && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">{t('fr.outgoing')}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {friends.data.outgoing.map((f) => (
              <li key={f.id}>
                <Badge>{f.name}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      <BlockedList />
    </>
  );
}

function notifText(n: Notification, t: ReturnType<typeof useI18n>['t'], locale: string) {
  const p = n.payload;
  const date = typeof p.date === 'string' ? new Date(`${p.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
  const response = typeof p.response === 'string' ? t(`out.${p.response}` as 'out.yes') : '';
  return t(`notif.${n.type}` as 'notif.outing_invite', { name: String(p.name ?? '—'), from: String(p.from ?? '—'), golf: String(p.golf ?? ''), date, response });
}

/** Bloquer un joueur (confirmation, puis rafraîchissement des listes) */
function BlockButton({ id, name, onDone }: { id: string; name: string | null; onDone: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm(t('mod.blockConfirm', { name: name ?? '—' }))) return;
        await api.block(id).catch(() => undefined);
        qc.invalidateQueries({ queryKey: ['blocks'] });
        onDone();
      }}
      className="h-11 px-1 text-xs text-red-700 hover:underline dark:text-red-300"
    >
      {t('mod.block')}
    </button>
  );
}

/** Joueurs bloqués, avec « Débloquer » */
function BlockedList() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['blocks'], queryFn: api.blocks });
  if (!q.data?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-muted">{t('mod.blocked')}</h3>
      <ul className="space-y-1">
        {q.data.map((u) => (
          <li key={u.id} className="flex min-h-11 items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            <button
              type="button"
              className="h-11 px-2 text-xs font-medium text-link"
              onClick={async () => {
                await api.unblock(u.id).catch(() => undefined);
                qc.invalidateQueries({ queryKey: ['blocks'] });
              }}
            >
              {t('mod.unblock')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotificationsBody() {
  const { t, locale } = useI18n();
  const { setOpen } = useRail();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const read = useMutation({ mutationFn: api.readNotifications, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  // Ouvrir le panneau marque les notifications comme lues (après un court délai pour laisser voir les nouvelles)
  useEffect(() => {
    if (!q.data?.unread) return;
    const id = setTimeout(() => read.mutate(), 2500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.unread]);
  if (q.isLoading) return <div className="skeleton h-16 w-full rounded-[20px]" aria-hidden />;
  if (!q.data?.items.length)
    return (
      <>
        {isNative() && <PushCard />}
        <p className="text-sm text-muted">{t('notif.empty')}</p>
      </>
    );
  return (
    <>
    {isNative() && <PushCard />}
    <ul className="space-y-2" aria-live="polite">
      {q.data.items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => {
              // Demande d'ami → panneau Amis ; partie → panneau Mes parties
              setOpen(n.type.startsWith('friend_') ? 'friends' : 'outings');
            }}
            className={cx('frost glass-interactive flex w-full items-center gap-2 rounded-[20px] p-3 text-left text-sm', !n.readAt && 'ring-2 ring-glacier-400/70')}
          >
            <span className="min-w-0 flex-1">
              <span className={cx('block', !n.readAt && 'font-semibold')}>{notifText(n, t, locale)}</span>
              <span className="block text-xs text-muted">{new Date(n.createdAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
    </>
  );
}

/** App iOS : proposition d'activer les notifications (l'autorisation n'est demandée qu'au clic) */
function PushCard() {
  const { t, lang } = useI18n();
  const [state, setState] = useState<PushState | 'busy' | 'error' | null>(null);
  useEffect(() => {
    void pushState().then(setState);
  }, []);
  if (state === null || state === 'unsupported' || state === 'granted') return null;
  if (state === 'denied') return <Notice>{t('push.denied')}</Notice>;
  return (
    <div className="frost mb-3 space-y-2 rounded-[20px] p-3">
      <p className="text-sm">{t('push.pitch')}</p>
      {state === 'error' && <p className="text-xs text-red-700 dark:text-red-300">{t('push.error')}</p>}
      <Button
        size="sm"
        variant="primary"
        disabled={state === 'busy'}
        onClick={async () => {
          haptic(10);
          setState('busy');
          setState(await enablePush(lang).catch(() => 'error' as const));
        }}
      >
        <Bell className="size-4" aria-hidden /> {t('push.enable')}
      </Button>
    </div>
  );
}

export function SettingsBody({ onNavigate }: { onNavigate: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme, currency, setCurrency } = useSettings();
  return (
    <>
      <div className="space-y-4">
        {[
          {
            label: t('settings.language'),
            el: <Segmented label={t('settings.language')} value={lang} onChange={setLang} options={LANGS.map((l) => ({ value: l, label: { fr: 'Français', en: 'English', es: 'Español' }[l] }))} size="sm" />,
          },
          {
            label: t('settings.currency'),
            el: <Segmented<Currency> label={t('settings.currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} size="sm" />,
          },
          {
            label: t('settings.theme'),
            el: (
              <Segmented<Theme>
                label={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`theme.${v}`) }))}
                size="sm"
              />
            ),
          },
        ].map(({ label, el }) => (
          <div key={label}>
            <p className="mb-1.5 text-sm font-medium">{label}</p>
            <div className="no-scrollbar overflow-x-auto">{el}</div>
          </div>
        ))}
      </div>
      <Notice>{t('welcome.privacy')}</Notice>
      <div className="frost overflow-hidden rounded-[20px]">
        {[
          { to: '/conditions', label: t('nav.terms'), Icon: FileText },
          { to: '/confidentialite', label: t('nav.privacy'), Icon: ShieldCheck },
          { to: '/mentions-legales', label: t('nav.legal'), Icon: Lock },
          // Administration : sur le site seulement, pas dans l'app
          ...(isNative() ? [] : [{ to: '/admin', label: t('account.admin'), Icon: Wrench }]),
        ].map(({ to, label, Icon }) => (
          <Link key={to} to={to} onClick={onNavigate} className="flex min-h-12 items-center gap-3 px-4 hover:bg-white/30 dark:hover:bg-white/5">
            <Icon className="size-4 text-muted" aria-hidden />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ChevronRight className="size-4 text-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </>
  );
}
