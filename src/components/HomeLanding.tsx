import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Flag, HelpCircle, Share2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, type Outing } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayStr, useSearch } from '../state/search';
import { shareUrl } from './RailPanels';
import { Badge, Button, buttonClass, cx, haptic } from './ui';

const TONE = { yes: 'green', maybe: 'gold', no: 'red', pending: 'neutral' } as const;

/** Partie en cours (organisée par moi ou à laquelle je suis invité) avec Rejoindre / Décliner. */
export function GameCard({ o }: { o: Outing }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const respond = useMutation({
    mutationFn: (r: 'yes' | 'maybe' | 'no') => api.respondOuting(o.id, r),
    onSuccess: () => {
      haptic(14);
      qc.invalidateQueries({ queryKey: ['outings'] });
    },
  });
  const date = new Date(`${o.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const going = o.guests.filter((g) => g.response === 'yes').length + 1;

  return (
    <li className="frost animate-rise space-y-3 rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold tracking-tight">{o.golf.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted tabular-nums">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 whitespace-nowrap first-letter:uppercase">
              {date} · {o.timeFrom}–{o.timeTo}
            </span>
          </p>
          <p className="text-xs text-muted">
            {o.isOrganizer ? t('out.mine') : t('out.by', { name: o.organizer.name ?? '—' })} · {t('home.going', { n: going, total: o.players })}
          </p>
        </div>
        {!o.isOrganizer && o.myResponse && o.myResponse !== 'pending' && <Badge tone={TONE[o.myResponse]}>{t(`out.${o.myResponse}` as 'out.yes')}</Badge>}
      </div>

      {o.guests.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('inv.answers')}>
          {o.guests.map((g, i) => (
            <li key={g.id ?? i}>
              <Badge tone={TONE[g.response]}>
                {g.name ?? '—'} · {t(`out.${g.response}` as 'out.yes')}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!o.isOrganizer ? (
        <div role="group" aria-label={t('out.answer')} className="grid grid-cols-[1fr_auto_1fr] gap-2">
          <button
            type="button"
            aria-pressed={o.myResponse === 'yes'}
            onClick={() => respond.mutate('yes')}
            className={cx(buttonClass(o.myResponse === 'yes' ? 'primary' : 'secondary'), 'w-full')}
          >
            <Check className="size-4" aria-hidden /> {t('home.join')}
          </button>
          <button
            type="button"
            aria-pressed={o.myResponse === 'maybe'}
            onClick={() => respond.mutate('maybe')}
            className={cx(buttonClass(o.myResponse === 'maybe' ? 'gold' : 'secondary'), 'px-3')}
            aria-label={t('out.maybe')}
            title={t('out.maybe')}
          >
            <HelpCircle className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-pressed={o.myResponse === 'no'}
            onClick={() => respond.mutate('no')}
            className={cx(buttonClass('secondary'), 'w-full', o.myResponse === 'no' && '!bg-red-700 !text-white')}
          >
            <X className="size-4" aria-hidden /> {t('home.decline')}
          </button>
        </div>
      ) : (
        o.shareToken && (
          <Button
            size="sm"
            onClick={async () => {
              const url = shareUrl(o.shareToken!);
              if (navigator.share) await navigator.share({ title: o.golf.name, text: o.message ?? undefined, url }).catch(() => undefined);
              else await navigator.clipboard.writeText(url).catch(() => undefined);
            }}
          >
            <Share2 className="size-4" aria-hidden /> {t('out.share')}
          </Button>
        )
      )}
    </li>
  );
}

/** Accueil : bouton « New game » puis parties en cours avec les amis. */
export function HomeLanding() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { setView } = useSearch();
  const outings = useQuery({ queryKey: ['outings'], queryFn: api.outings, enabled: !!user, refetchInterval: 60_000 });
  const today = todayStr();
  const current = (outings.data ?? []).filter((o) => o.status === 'active' && o.date >= today).sort((a, b) => (a.date + a.timeFrom).localeCompare(b.date + b.timeFrom));

  return (
    <div className="space-y-6">
      <div className="space-y-2 pt-1">
        <h1 className="text-[26px] leading-tight">{user?.name ? t('home.hello', { name: user.name }) : t('welcome.title')}</h1>
        <p className="text-[15px] text-muted">{t('home.subtitle')}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          haptic(16);
          setView('search');
        }}
        className="group relative flex h-20 w-full items-center justify-center gap-3 overflow-hidden rounded-[24px] bg-fairway-700 text-[22px] font-semibold tracking-tight text-white shadow-[0_12px_32px_rgba(31,93,74,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] dark:bg-fairway-300 dark:text-fairway-950"
      >
        <span className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,0.25),transparent_60%)]" aria-hidden />
        <Flag className="relative size-6" aria-hidden />
        <span className="relative">{t('home.newGame')}</span>
      </button>

      <section aria-labelledby="current-games" className="space-y-3">
        <h2 id="current-games" className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t('home.current')}
        </h2>
        {!user ? (
          <div className="frost space-y-3 rounded-[22px] p-4">
            <p className="text-sm">{t('home.loginToSee')}</p>
            <Link to="/connexion" className={buttonClass('secondary', 'sm')}>
              {t('auth.cta')}
            </Link>
          </div>
        ) : outings.isLoading ? (
          <div className="skeleton h-32 w-full rounded-[24px]" aria-hidden />
        ) : current.length === 0 ? (
          <p className="frost rounded-[22px] p-4 text-sm text-muted">{t('home.noGames')}</p>
        ) : (
          <ul className="space-y-3">
            {current.map((o) => (
              <GameCard key={o.id} o={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
