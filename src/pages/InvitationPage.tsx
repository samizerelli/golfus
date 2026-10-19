import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, Clock, Navigation, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GlassCard } from '../components/glass';
import { Logo } from '../components/Logo';
import { Badge, buttonClass, cx, Notice } from '../components/ui';
import { useI18n } from '../i18n';
import { api, type ApiError } from '../lib/api';
import { directionsUrl } from '../lib/links';

const TONE = { yes: 'green', maybe: 'gold', no: 'red', pending: 'neutral' } as const;
const tokenKey = (t: string) => `gf.guest.${t}`;

/** Page publique d'une invitation (lien partagé par WhatsApp / SMS) : répondre sans compte. */
export function InvitationPage() {
  const { token = '' } = useParams();
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['invitation', token], queryFn: () => api.invitation(token), retry: false });
  const [name, setName] = useState('');
  const [answer, setAnswer] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const respond = useMutation({
    mutationFn: (response: 'yes' | 'maybe' | 'no') => {
      let guestToken: string | undefined;
      try {
        guestToken = localStorage.getItem(tokenKey(token)) ?? undefined;
      } catch {
        /* stockage indisponible */
      }
      return api.respondInvitation(token, { name: name.trim(), response, guestToken });
    },
    onSuccess: (r) => {
      try {
        localStorage.setItem(tokenKey(token), r.guestToken);
      } catch {
        /* stockage indisponible */
      }
      q.refetch();
    },
  });

  const o = q.data;
  const label = (r: string) => t(`out.${r}` as 'out.yes');
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-12">
        <header className="flex items-center gap-3">
          <Logo className="size-10" />
          <h1 className="text-[26px] leading-tight">{t('inv.title')}</h1>
        </header>
        {q.isLoading && <div className="skeleton h-48 w-full rounded-[28px]" aria-hidden />}
        {q.isError && <Notice tone="error">{(q.error as ApiError).status === 404 ? t('inv.notFound') : t('common.error')}</Notice>}
        {o && (
          <GlassCard className="space-y-4 p-5">
            <p className="text-sm font-medium text-muted">{t('inv.from', { name: o.organizer.name ?? '—' })}</p>
            <h2 className="text-2xl">{o.golf.name}</h2>
            <ul className="space-y-1.5 text-[15px]">
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted" aria-hidden />
                {new Date(`${o.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </li>
              <li className="flex items-center gap-2 tabular-nums">
                <Clock className="size-4 text-muted" aria-hidden />
                {o.timeFrom} – {o.timeTo}
                {o.holes ? ` · ${t('card.holes', { n: o.holes })}` : ''}
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 text-muted" aria-hidden />
                {o.players} {t('s1.players').toLowerCase()}
              </li>
            </ul>
            {o.message && <p className="frost rounded-[18px] p-3 text-sm whitespace-pre-line">{o.message}</p>}
            {o.golf.lat != null && o.golf.lon != null && (
              <a href={directionsUrl(o.golf.lat, o.golf.lon, o.golf.name)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                <Navigation className="size-4" aria-hidden /> {t('action.directions')}
              </a>
            )}

            {o.status === 'cancelled' ? (
              <Notice tone="warn">{t('inv.cancelled')}</Notice>
            ) : respond.isSuccess ? (
              <Notice>
                <span className="flex items-center gap-2">
                  <Check className="size-4" aria-hidden /> {t('inv.thanks')}
                </span>
              </Notice>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (answer) respond.mutate(answer);
                }}
              >
                <label className="block text-sm font-medium">
                  {t('inv.yourName')}
                  <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className="frost mt-1.5 h-12 w-full rounded-[16px] px-4 text-base" />
                </label>
                <div role="radiogroup" aria-label={t('out.answer')} className="grid grid-cols-3 gap-2">
                  {(['yes', 'maybe', 'no'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={answer === r}
                      onClick={() => setAnswer(r)}
                      className={cx('h-12 rounded-[16px] border text-sm font-semibold', answer === r ? 'border-fairway-700 bg-fairway-700 text-white' : 'frost')}
                    >
                      {label(r)}
                    </button>
                  ))}
                </div>
                <button type="submit" disabled={!answer || !name.trim() || respond.isPending} className={buttonClass('primary') + ' w-full'}>
                  {t('inv.send')}
                </button>
                {respond.isError && <Notice tone="error">{t('common.error')}</Notice>}
              </form>
            )}

            {o.guests.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">{t('inv.answers')}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {o.guests.map((g, i) => (
                    <li key={i}>
                      <Badge tone={TONE[g.response]}>
                        {g.name ?? '—'} · {label(g.response)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
