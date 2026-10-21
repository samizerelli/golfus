import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { cx, haptic } from './ui';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

/** Hauteurs des 3 crans, calculées sur la hauteur visible réelle (équivalent 100dvh) */
function heights() {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  // Plein écran : sous l'encoche / Dynamic Island de l'iPhone (zone sûre du haut), avec une marge
  return { peek: 196, half: Math.round(vh * 0.5), full: Math.round(vh - Math.max(64, safeTop() + 16)) };
}

/** Hauteur de la zone sûre du haut (encoche), lue depuis env(safe-area-inset-top) */
function safeTop() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

/**
 * Tiroir de verre à 3 crans (réduit / mi-hauteur / plein écran).
 * Glisser la poignée : la vitesse du geste est prise en compte (inertie) pour choisir le cran.
 * Toucher la poignée ou Entrée : passe au cran suivant.
 */
export function BottomSheet({ snap, onSnap, header, children }: { snap: Snap; onSnap: (s: Snap) => void; header?: ReactNode; children: ReactNode }) {
  const { t } = useI18n();
  const [h, setH] = useState(heights);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; height: number } | null>(null);
  const samples = useRef<{ y: number; t: number }[]>([]);
  const moved = useRef(false);

  useEffect(() => {
    const on = () => setH(heights());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);

  const height = drag ?? h[snap];

  const onPointerDown = (e: PointerEvent) => {
    start.current = { y: e.clientY, height: h[snap] };
    samples.current = [{ y: e.clientY, t: e.timeStamp }];
    moved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return;
    const dy = start.current.y - e.clientY;
    if (Math.abs(dy) > 5) moved.current = true;
    samples.current.push({ y: e.clientY, t: e.timeStamp });
    if (samples.current.length > 6) samples.current.shift();
    // Résistance élastique au-delà des bornes
    let next = start.current.height + dy;
    if (next > h.full) next = h.full + (next - h.full) * 0.25;
    if (next < h.peek) next = h.peek - (h.peek - next) * 0.25;
    setDrag(next);
  };
  const onPointerUp = () => {
    if (!start.current) return;
    if (drag !== null && moved.current) {
      const s = samples.current;
      const v = s.length > 1 ? (s[0].y - s[s.length - 1].y) / Math.max(1, s[s.length - 1].t - s[0].t) : 0; // px/ms, >0 = vers le haut
      const projected = drag + v * 220;
      const target = (Object.entries(h) as [Snap, number][]).reduce((a, b) => (Math.abs(b[1] - projected) < Math.abs(a[1] - projected) ? b : a))[0];
      if (target !== snap) haptic(6);
      onSnap(target);
    }
    start.current = null;
    setDrag(null);
  };
  const cycle = () => {
    if (moved.current) return;
    onSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
  };

  return (
    <div
      className={cx(
        'glass glass-refract absolute inset-x-0 bottom-0 z-[1000] mx-auto flex max-w-[640px] flex-col rounded-t-[28px] border-b-0',
        drag === null && 'transition-[height] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
      )}
      style={{ height }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={cycle}
        aria-expanded={snap !== 'peek'}
        aria-label={snap === 'full' ? t('sheet.collapse') : t('sheet.expand')}
        className="-mb-3 flex h-11 w-full shrink-0 cursor-grab touch-none items-start justify-center pt-2.5 active:cursor-grabbing"
      >
        <span className="h-[5px] w-10 rounded-full bg-[rgba(15,26,36,0.22)] dark:bg-white/30" aria-hidden />
      </button>
      {header && <div className="shrink-0 px-4">{header}</div>}
      <div data-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
