import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe, Mail, MessageCircle, Minus, Phone, Plus, Search, Ticket } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import type { GolfSummary } from '../../shared/types';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { prefilledBookingUrl } from '../lib/booking';
import { telHref } from '../lib/links';
import { useSearch } from '../state/search';
import { buttonClass, Dialog, haptic, Notice } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 15) * 15)}`;

/** Numéro utilisable par WhatsApp : uniquement s'il est au format international (+…), sinon le pays est inconnu. */
function whatsappNumber(phone: string | null) {
  if (!phone) return null;
  const p = phone.trim();
  if (!p.startsWith('+') && !p.startsWith('00')) return null;
  const digits = p.replace(/^00/, '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function Option({ href, icon, title, hint, external = true, primary = false }: { href: string; icon: ReactNode; title: string; hint?: string; external?: boolean; primary?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => haptic()}
      className={
        primary
          ? 'flex min-h-14 items-center gap-3 rounded-[20px] bg-fairway-700 px-4 py-3 text-white shadow-[0_6px_20px_rgba(31,93,74,0.28)] transition-transform active:scale-[0.98] dark:bg-fairway-300 dark:text-fairway-950'
          : 'frost glass-interactive flex min-h-14 items-center gap-3 rounded-[20px] px-4 py-3'
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {hint && <span className="block text-xs opacity-75">{hint}</span>}
      </span>
      {external && <ExternalLink className="size-4 shrink-0 opacity-60" aria-hidden />}
    </a>
  );
}

/**
 * Bouton « Réserver » présent sur chaque golf. Il n'existe pas d'API de réservation universelle :
 * on propose le lien de réservation connu, le site officiel, ou une demande de départ préremplie
 * (e-mail / WhatsApp) — jamais de confirmation affichée à la place du golf.
 */
export function BookingButton({ golf, size = 'sm' }: { golf: GolfSummary; size?: 'sm' | 'md' }) {
  const { t, locale } = useI18n();
  const { playAt, criteria } = useSearch();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => toDate(playAt));
  const [time, setTime] = useState(() => toTime(playAt));
  const [players, setPlayers] = useState(criteria.players);
  // L'e-mail n'est pas dans la liste de résultats : on charge la fiche à l'ouverture (mise en cache)
  const detail = useQuery({ queryKey: ['golf', golf.id], queryFn: () => api.golf(golf.id), enabled: open, staleTime: 10 * 60_000 });
  const email = detail.data?.email ?? null;
  const phone = golf.phone ?? detail.data?.phone ?? null;
  const wa = whatsappNumber(phone);

  const niceDate = new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const subject = t('book.subject', { date: niceDate, time });
  const body = t('book.body', { players, date: niceDate, time, golf: golf.name });
  const nothing = !golf.bookingUrl && !golf.website && !email && !phone;

  // Réservation en ligne connue : un clic ouvre la page du golf déjà réglée (date, joueurs, matin/après-midi)
  if (golf.bookingUrl) {
    const link = prefilledBookingUrl(golf.bookingUrl, { date: criteria.date, timeFrom: criteria.timeFrom, timeTo: criteria.timeTo, players: criteria.players });
    const when = new Date(`${criteria.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          haptic();
        }}
        className={buttonClass('gold', size)}
        title={link.filled.date ? t('book.prefilledFor', { date: when, n: criteria.players }) : t('book.onlineHint')}
      >
        <Ticket className="size-4" aria-hidden />
        {t('action.book')}
        <ExternalLink className="size-3.5 opacity-60" aria-hidden />
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          haptic();
          setDate(toDate(playAt));
          setTime(toTime(playAt));
          setPlayers(criteria.players);
          setOpen(true);
        }}
        className={buttonClass('gold', size)}
        aria-haspopup="dialog"
      >
        <Ticket className="size-4" aria-hidden />
        {t('action.book')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${t('book.title')} · ${golf.name || t('card.unnamed')}`}>
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm font-medium">
              {t('search.date')}
              <input type="date" min={toDate(new Date())} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="frost mt-1.5 h-12 rounded-[16px] px-3 text-base text-ink" />
            </label>
            <label className="flex flex-col text-sm font-medium">
              {t('search.time')}
              <input type="time" step={600} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className="frost mt-1.5 h-12 rounded-[16px] px-3 text-base text-ink" />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span id="players-label" className="text-sm font-medium">
              {t('book.players')}
            </span>
            <div className="frost flex items-center gap-1 rounded-full p-1" role="group" aria-labelledby="players-label">
              <button type="button" className="grid size-11 place-items-center rounded-full disabled:opacity-40" onClick={() => setPlayers((p) => Math.max(1, p - 1))} disabled={players <= 1} aria-label="−1">
                <Minus className="size-4" aria-hidden />
              </button>
              <output className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {players}
              </output>
              <button type="button" className="grid size-11 place-items-center rounded-full disabled:opacity-40" onClick={() => setPlayers((p) => Math.min(8, p + 1))} disabled={players >= 8} aria-label="+1">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {golf.bookingUrl && <Option primary href={golf.bookingUrl} icon={<Ticket className="size-5" aria-hidden />} title={t('book.online')} hint={t('book.onlineHint')} />}
            {golf.website && (
              <Option
                primary={!golf.bookingUrl}
                href={golf.pricingUrl ?? golf.website}
                icon={<Globe className="size-5" aria-hidden />}
                title={t('book.website')}
                hint={t('book.onlineHint')}
              />
            )}
            {email && (
              <Option
                external={false}
                href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                icon={<Mail className="size-5" aria-hidden />}
                title={t('book.email')}
                hint={t('book.prefilled')}
              />
            )}
            {wa && (
              <Option href={`https://wa.me/${wa}?text=${encodeURIComponent(body)}`} icon={<MessageCircle className="size-5" aria-hidden />} title={t('book.whatsapp')} hint={t('book.prefilled')} />
            )}
            {phone && <Option external={false} href={telHref(phone)} icon={<Phone className="size-5" aria-hidden />} title={t('book.call')} hint={phone} />}
            {detail.isLoading && <div className="skeleton h-14 w-full rounded-[20px]" aria-hidden />}
            {nothing && !detail.isLoading && !email && (
              <>
                <Notice>{t('book.none')}</Notice>
                <Option
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${golf.name} ${t('book.searchTerms')}`)}`}
                  icon={<Search className="size-5" aria-hidden />}
                  title={t('book.search')}
                />
              </>
            )}
          </div>
          <p className="text-xs text-muted">{t('book.notice')}</p>
        </div>
      </Dialog>
    </>
  );
}
