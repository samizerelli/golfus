import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Clock, Flag, HelpCircle, Navigation, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Badge, buttonClass, cx, haptic } from '../components/ui';
import { useI18n } from '../i18n';
import { api, type ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { directionsUrl } from '../lib/links';
import { readStore, writeStore } from '../lib/storage';
import { todayStr } from '../state/search';
import { errorMessage, ReportButton } from '../components/Moderation';

type Resp = 'yes' | 'maybe' | 'no';
const TONE = { yes: 'green', maybe: 'gold', no: 'red', pending: 'neutral' } as const;
const tokenKey = (t: string) => `gf.guest.${t}`;

/**
 * Écran ouvert par le lien d'invitation (WhatsApp / SMS / app) : Rejoindre ou Décliner directement.
 * Connecté : un geste. Sans compte : prénom puis choix (le prénom est mémorisé sur l'appareil).
 */
export function InvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invitation', token, user?.id], queryFn: () => api.invitation(token), retry: false });
  const [name, setName] = useState(() => readStore<string>('gf.guestName', ''));
  const [answered, setAnswered] = useState<Resp | null>(null);
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const respond = useMutation({
    mutationFn: (response: Resp) =>
      api.respondInvitation(token, { name: user ? undefined : name.trim(), response, guestToken: readStore<string | undefined>(tokenKey(token), undefined) }),
    onSuccess: (r, response) => {
      haptic(18);
      if (!user) {
        writeStore(tokenKey(token), r.guestToken);
        writeStore('gf.guestName', name.trim());
      }
      setAnswered(response);
      qc.invalidateQueries({ queryKey: ['invitation', token] });
      qc.invalidateQueries({ queryKey: ['outings'] });
    },
  });

  const choose = (r: Resp) => {
    if (!user && !name.trim()) {
      setNeedName(true);
      nameRef.current?.focus();
      return;
    }
    respond.mutate(r);
  };

  const o = q.data;
  const current: Resp | null = answered ?? ((o?.myResponse && o.myResponse !== 'pending' ? o.myResponse : null) as Resp | null);
  const label = (r: string) => t(`out.${r}` as 'out.yes');

  return (
    <div className="intro relative min-h-0 flex-1 overflow-y-auto text-white">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link to="/" className="flex items-center gap-2 self-start rounded-full" aria-label="GolfUs">
          <Logo className="size-9" />
          <span className="text-lg font-semibold tracking-tight">
            Golf<span className="text-gold-400">Us</span>
          </span>
        </Link>

        {q.isLoading && <div className="h-72 animate-pulse rounded-[28px] bg-white/10" aria-hidden />}
        {q.isError && (
          <p className="rounded-[24px] bg-white/10 p-5 text-center" role="alert">
            {(q.error as ApiError).status === 404 ? t('inv.notFound') : t('common.error')}
          </p>
        )}

        {o && (
          <>
            <div className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <p className="text-sm font-medium text-white/80">{t('inv.from', { name: o.organizer.name ?? '—' })}</p>
              <h1 className="mt-1 text-[30px] leading-[1.1]">{o.golf.name}</h1>
              <ul className="mt-4 space-y-2 text-[15px] text-white/90">
                <li className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-gold-300" aria-hidden />
                  <span className="first-letter:uppercase">{new Date(`${o.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </li>
                <li className="flex items-center gap-2 tabular-nums">
                  <Clock className="size-4 text-gold-300" aria-hidden />
                  {o.timeFrom} – {o.timeTo}
                  {o.holes ? ` · ${t('card.holes', { n: o.holes })}` : ''}
                </li>
                <li className="flex items-center gap-2">
                  <Users className="size-4 text-gold-300" aria-hidden />
                  {o.players} {t('s1.players').toLowerCase()}
                </li>
              </ul>
              {o.message && <p className="mt-4 rounded-[18px] bg-black/15 p-3 text-sm whitespace-pre-line">{o.message}</p>}
              {o.golf.lat != null && o.golf.lon != null && (
                <a
                  href={directionsUrl(o.golf.lat, o.golf.lon, o.golf.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25"
                >
                  <Navigation className="size-4" aria-hidden /> {t('action.directions')}
                </a>
              )}
              {/* Invitation déplacée ou organisateur importun : signalement (compte requis) et blocage */}
              {user && !o.isOrganizer && (
                <div className="mt-2 flex gap-3 text-white/80 [&_button]:text-white/75">
                  <ReportButton kind="outing" targetId={o.id} />
                  <button
                    type="button"
                    className="min-h-11 text-xs hover:underline"
                    onClick={async () => {
                      if (!confirm(t('mod.blockConfirm', { name: o.organizer.name ?? '—' }))) return;
                      await api.block(o.organizer.id).catch(() => undefined);
                      navigate('/');
                    }}
                  >
                    {t('mod.block')}
                  </button>
                </div>
              )}
            </div>

            {o.status === 'cancelled' || o.date < todayStr() ? (
              <p className="rounded-[24px] bg-white/10 p-5 text-center font-medium" role="status">
                {t(o.status === 'cancelled' ? 'inv.cancelled' : 'inv.past')}
              </p>
            ) : o.isOrganizer ? (
              <p className="rounded-[24px] bg-white/10 p-5 text-center" role="status">
                {t('out.mine')}
              </p>
            ) : current && !respond.isPending ? (
              /* Confirmation */
              <div className="animate-rise space-y-4 rounded-[28px] bg-white/10 p-5 text-center" role="status">
                <span className={cx('mx-auto grid size-16 place-items-center rounded-full', current === 'yes' ? 'bg-fairway-300 text-fairway-950' : current === 'no' ? 'bg-white/20' : 'bg-gold-400 text-fairway-950')}>
                  {current === 'yes' ? <Check className="size-8" aria-hidden /> : current === 'no' ? <X className="size-8" aria-hidden /> : <HelpCircle className="size-8" aria-hidden />}
                </span>
                <p className="text-xl font-semibold">{t(current === 'yes' ? 'inv.joined' : current === 'no' ? 'inv.declined' : 'inv.maybeDone')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => setAnswered(null)} className="h-11 rounded-full px-4 text-sm font-semibold text-white/85 underline-offset-4 hover:underline">
                    {t('inv.change')}
                  </button>
                  <Link to="/" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-fairway-900">
                    <Flag className="size-4" aria-hidden /> {t('inv.openApp')}
                  </Link>
                </div>
              </div>
            ) : (
              /* Rejoindre / Décliner */
              <div className="space-y-3">
                {!user && (
                  <label className="block text-sm font-medium text-white/90">
                    {t('inv.yourName')}
                    <input
                      ref={nameRef}
                      maxLength={60}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNeedName(false);
                      }}
                      autoComplete="given-name"
                      aria-invalid={needName}
                      className={cx('mt-1.5 h-12 w-full rounded-[16px] border bg-white/95 px-4 text-base text-fairway-950 placeholder:text-fairway-900/50', needName ? 'border-gold-400 ring-2 ring-gold-400' : 'border-transparent')}
                    />
                    {needName && <span className="mt-1 block text-xs text-gold-200">{t('inv.nameFirst')}</span>}
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => choose('yes')}
                  disabled={respond.isPending}
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-[22px] bg-white text-xl font-semibold text-fairway-900 shadow-[0_12px_30px_rgba(0,0,0,0.3)] transition-transform active:scale-[0.97] disabled:opacity-70"
                >
                  <Check className="size-6" aria-hidden /> {t('home.join')}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => choose('maybe')} disabled={respond.isPending} className="h-12 rounded-[18px] border border-white/30 bg-white/10 font-semibold transition-transform active:scale-[0.97]">
                    {t('out.maybe')}
                  </button>
                  <button type="button" onClick={() => choose('no')} disabled={respond.isPending} className="h-12 rounded-[18px] border border-white/30 bg-white/10 font-semibold transition-transform active:scale-[0.97]">
                    {t('home.decline')}
                  </button>
                </div>
                {respond.isError && <p className="text-center text-sm text-gold-200" role="alert">{errorMessage(respond.error, t, 'common.error')}</p>}
                {!user && (
                  <p className="text-center text-xs text-white/75">
                    {t('inv.haveAccount')}{' '}
                    <Link to={`/connexion?retour=${encodeURIComponent(`/invitation/${token}`)}`} className="font-semibold underline">
                      {t('auth.tabLogin')}
                    </Link>
                  </p>
                )}
              </div>
            )}

            {o.guests.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-white/85">{t('inv.answers')}</p>
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
          </>
        )}
        <Link to="/" className={cx(buttonClass('ghost', 'sm'), 'mt-auto self-center !text-white/70')}>
          GolfUs
        </Link>
      </div>
    </div>
  );
}
