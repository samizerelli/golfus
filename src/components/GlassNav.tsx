import { Compass, Heart, UserRound } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useFavorites } from '../lib/favorites';
import { cx, haptic } from './ui';

const ITEMS = [
  { to: '/', key: 'nav.explore', Icon: Compass },
  { to: '/favoris', key: 'nav.favorites', Icon: Heart },
  { to: '/profil', key: 'nav.profile', Icon: UserRound },
] as const;

/**
 * Barre de navigation flottante en forme de pilule. L'indicateur actif glisse d'un onglet à l'autre
 * en s'étirant brièvement, comme une goutte (effet « liquide »).
 */
export function GlassNav({ className }: { className?: string }) {
  const { t } = useI18n();
  const { favorites } = useFavorites();
  const { pathname } = useLocation();
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [stretch, setStretch] = useState(false);
  const active = ITEMS.findIndex((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));

  useLayoutEffect(() => {
    const el = refs.current[active];
    const ul = listRef.current;
    if (!el || !ul) return setBox(null);
    // Position relative à la liste (offsetLeft serait relatif au <li>, positionné)
    const x = el.getBoundingClientRect().left - ul.getBoundingClientRect().left;
    setBox((prev) => {
      if (prev && Math.abs(prev.x - x) > 1) {
        setStretch(true);
        setTimeout(() => setStretch(false), 180);
      }
      return { x, w: el.offsetWidth };
    });
  }, [active, t]);

  return (
    <nav aria-label="Navigation" className={cx('glass glass-refract pointer-events-auto rounded-full p-1.5', className)}>
      <ul ref={listRef} className="relative flex items-center">
        {box && (
          <li
            aria-hidden
            className="absolute top-0 bottom-0 left-0 rounded-full bg-white/85 shadow-[0_4px_14px_rgba(31,70,110,0.18),inset_0_1px_0_#fff] transition-[transform,width] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white/15 dark:shadow-none"
            style={{ width: box.w, transform: `translateX(${box.x}px) scaleX(${stretch ? 1.12 : 1}) scaleY(${stretch ? 0.92 : 1})` }}
          />
        )}
        {ITEMS.map(({ to, key, Icon }, i) => (
          <li key={to} className="relative">
            <NavLink
              to={to}
              end={to === '/'}
              ref={(el) => {
                refs.current[i] = el;
              }}
              onClick={() => haptic()}
              className={({ isActive }) =>
                cx(
                  'flex h-11 min-w-[76px] items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-300',
                  isActive ? 'text-ink' : 'text-muted hover:text-ink',
                )
              }
            >
              <span className="relative">
                <Icon className="size-[19px]" aria-hidden />
                {to === '/favoris' && favorites.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-[#0f1a24]">
                    {favorites.length}
                  </span>
                )}
              </span>
              <span>{t(key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
