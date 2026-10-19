import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, Heart, Settings2, UserRound, Users, X } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMediaQuery } from '../lib/useMediaQuery';
import { Avatar } from './AccountPanel';
import { FavoritesBody, FriendsBody, NotificationsBody, OutingsBody, SettingsBody, AccountBody } from './RailPanels';
import { buttonClass, cx, haptic } from './ui';

export type PanelKey = 'account' | 'favorites' | 'outings' | 'friends' | 'notifications' | 'settings';

const RailContext = createContext<{ open: PanelKey | null; setOpen: (k: PanelKey | null) => void } | null>(null);
export function RailProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<PanelKey | null>(null);
  return <RailContext.Provider value={{ open, setOpen }}>{children}</RailContext.Provider>;
}
export const useRail = () => {
  const c = useContext(RailContext);
  if (!c) throw new Error('useRail hors du RailProvider');
  return c;
};

const ITEMS: { key: PanelKey; Icon: typeof Bell; label: 'rail.account' | 'rail.favorites' | 'rail.outings' | 'rail.friends' | 'rail.notifications' | 'rail.settings'; needsAuth: boolean }[] = [
  { key: 'account', Icon: UserRound, label: 'rail.account', needsAuth: false },
  { key: 'favorites', Icon: Heart, label: 'rail.favorites', needsAuth: false },
  { key: 'outings', Icon: CalendarDays, label: 'rail.outings', needsAuth: true },
  { key: 'friends', Icon: Users, label: 'rail.friends', needsAuth: true },
  { key: 'notifications', Icon: Bell, label: 'rail.notifications', needsAuth: true },
  { key: 'settings', Icon: Settings2, label: 'rail.settings', needsAuth: false },
];

/** Panneau de verre ouvert depuis le menu (à gauche du menu sur ordinateur, tiroir plein écran sur mobile). */
function RailPanel({ k, onClose }: { k: PanelKey; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const ref = useRef<HTMLDivElement>(null);
  const item = ITEMS.find((i) => i.key === k)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, a, input')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, k]);

  const body =
    item.needsAuth && !user ? (
      <div className="space-y-3 p-1">
        <p className="text-sm text-muted">{t('rail.loginNeeded')}</p>
        <Link to="/connexion" onClick={onClose} className={buttonClass('primary') + ' w-full'}>
          {t('auth.cta')}
        </Link>
      </div>
    ) : k === 'account' ? (
      <AccountBody onNavigate={onClose} />
    ) : k === 'favorites' ? (
      <FavoritesBody onNavigate={onClose} />
    ) : k === 'outings' ? (
      <OutingsBody />
    ) : k === 'friends' ? (
      <FriendsBody />
    ) : k === 'notifications' ? (
      <NotificationsBody />
    ) : (
      <SettingsBody onNavigate={onClose} />
    );

  const panel = (
    <div
      ref={ref}
      role="dialog"
      aria-label={t(item.label)}
      className={cx(
        'glass glass-strong animate-rise flex flex-col',
        desktop ? 'fixed top-4 right-[92px] bottom-4 z-[1300] w-[380px] rounded-[28px]' : 'fixed inset-x-0 bottom-0 z-[1600] max-h-[88dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-xl">{t(item.label)}</h2>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-card-2" aria-label={t('rail.close')}>
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">{body}</div>
    </div>
  );
  if (desktop) return panel;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[1550] bg-[rgba(15,26,36,0.25)]" onClick={onClose} aria-hidden />
      {panel}
    </>,
    document.body,
  );
}

/**
 * Menu vertical d'actions (en verre, collé au bord droit). Libellés au survol / au focus sur ordinateur.
 * Sur mobile : barre verticale compacte en haut à droite, toujours accessible au pouce.
 */
export function ActionRail() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { open, setOpen } = useRail();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, enabled: !!user, refetchInterval: 60_000 });
  const unread = notifs.data?.unread ?? 0;

  return (
    <>
      <nav
        aria-label={t('rail.menu')}
        className={cx(
          'glass glass-refract fixed z-[1250] flex gap-1 rounded-full p-1.5',
          desktop ? 'top-1/2 right-4 -translate-y-1/2 flex-col' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex-row',
        )}
      >
        {ITEMS.map(({ key, Icon, label }) => {
          const active = open === key;
          return (
            <div key={key} className="group relative">
              <button
                type="button"
                onClick={() => {
                  haptic();
                  setOpen(active ? null : key);
                }}
                aria-pressed={active}
                aria-label={t(label)}
                className={cx(
                  'relative grid place-items-center rounded-full transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95',
                  desktop ? 'size-12' : 'size-11',
                  active ? 'bg-white/85 shadow-[0_4px_14px_rgba(31,70,110,0.18)] dark:bg-white/15' : 'hover:bg-white/40 dark:hover:bg-white/10',
                )}
              >
                {key === 'account' && user ? <Avatar src={user.image} name={user.name} size={26} /> : <Icon className="size-[21px]" aria-hidden />}
                {key === 'notifications' && unread > 0 && (
                  <span className="absolute top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" aria-label={`${unread}`}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {/* Libellé au survol / au focus (ordinateur) */}
              {desktop && (
                <span className="glass glass-strong pointer-events-none absolute top-1/2 right-[calc(100%+10px)] -translate-y-1/2 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100" aria-hidden>
                  {t(label)}
                </span>
              )}
            </div>
          );
        })}
      </nav>
      {open && <RailPanel k={open} onClose={() => setOpen(null)} />}
    </>
  );
}
