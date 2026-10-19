/**
 * Composants « Liquid Glass » réutilisables.
 * - GlassCard / GlassPill / GlassButton / GlassInput : surfaces de verre (.glass)
 * - GlassSheet : tiroir mobile (BottomSheet) ; GlassNavBar : navigation flottante (GlassNav)
 * - GlassFx : filtre SVG de réfraction + halos animés + reflet qui suit la souris / l'inclinaison
 */
import { forwardRef, useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from 'react';
import { cx } from './ui';

export { BottomSheet as GlassSheet } from './BottomSheet';
export { GlassNav as GlassNavBar } from './GlassNav';

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { strong?: boolean; refract?: boolean }>(
  function GlassCard({ className, strong, refract, ...p }, ref) {
    return <div ref={ref} className={cx('glass glass-rounded', strong && 'glass-strong', refract && 'glass-refract', className)} {...p} />;
  },
);

export const GlassPill = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>(
  function GlassPill({ className, active, type = 'button', ...p }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'glass glass-interactive inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold whitespace-nowrap',
          active &&
            '!border-fairway-700 !bg-fairway-700 !text-white shadow-[0_6px_18px_rgba(31,93,74,0.3)] dark:!border-fairway-300 dark:!bg-fairway-300 dark:!text-fairway-950',
          className,
        )}
        {...p}
      />
    );
  },
);

export const GlassButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { round?: boolean }>(
  function GlassButton({ className, round, type = 'button', ...p }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'glass glass-interactive inline-flex items-center justify-center gap-1.5 font-semibold',
          round ? 'size-11 rounded-full' : 'h-11 rounded-[20px] px-4 text-sm',
          className,
        )}
        {...p}
      />
    );
  },
);

export const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function GlassInput({ className, ...p }, ref) {
  return <input ref={ref} className={cx('glass h-12 rounded-[16px] px-4 text-base text-ink placeholder:text-muted', className)} {...p} />;
});

/** Choisit le niveau d'effet : la réfraction SVG n'est fiable que dans Chromium (Chrome, Edge). */
function detectFx() {
  const root = document.documentElement;
  const mq = (q: string) => window.matchMedia(q).matches;
  const reduced = mq('(prefers-reduced-motion: reduce)') || mq('(prefers-reduced-transparency: reduce)');
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const canBlur = CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  const refract = canBlur && chromium && !reduced && memory >= 4 && CSS.supports('backdrop-filter', 'url(#glass-distortion) blur(1px)');
  root.classList.toggle('fx-refract', refract);
  root.classList.toggle('fx-reduced', reduced);
  return { reduced };
}

/** Le reflet spéculaire suit la souris (ordinateur) ou l'inclinaison du téléphone (Android). */
function useShineTilt(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement.style;
    let raf = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.setProperty('--tilt-x', x.toFixed(3));
        root.setProperty('--tilt-y', y.toFixed(3));
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      set(Math.max(-1, Math.min(1, e.gamma / 45)) * 0.5, Math.max(-1, Math.min(1, (e.beta - 45) / 45)) * 0.5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    // iOS exige une autorisation explicite pour l'orientation : on ne l'utilise que là où elle est libre (Android)
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
    if (!needsPermission) window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [enabled]);
}

export function GlassFx() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    detectFx();
  }, []);
  useShineTilt(!reduced);
  return (
    <>
      {/* Filtre de réfraction (Chromium) : déforme légèrement ce qui passe derrière le verre */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* Halos de couleur flous, animés très lentement (bleu glacier, émeraude, champagne) */}
      <div className="halos" aria-hidden="true">
        <span className="halo halo-a" />
        <span className="halo halo-b" />
        <span className="halo halo-c" />
      </div>
    </>
  );
}
