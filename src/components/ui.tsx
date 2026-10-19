import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'glass';
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-fairway-700 text-white shadow-[0_6px_20px_rgba(31,93,74,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-fairway-600 dark:bg-fairway-300 dark:text-fairway-950 dark:hover:bg-fairway-200',
  secondary: 'frost text-ink hover:bg-white/80 dark:hover:bg-white/10',
  ghost: 'text-ink hover:bg-card-2',
  gold: 'bg-gold-500 text-[#0f1a24] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-gold-400',
  glass: 'glass text-ink',
};

/** Retour haptique léger (Android ; ignoré ailleurs) */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supporté */
  }
}

export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md') {
  return cx(
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[20px] font-medium whitespace-nowrap select-none',
    'transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] active:duration-100',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'h-11 px-3.5 text-sm' : 'h-12 px-5 text-[15px]',
    VARIANTS[variant],
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'gold' | 'demo'; title?: string }) {
  const tones = {
    neutral: 'bg-card-2 text-muted',
    green: 'bg-fairway-700 text-white dark:bg-fairway-300 dark:text-fairway-950',
    red: 'bg-[rgba(15,26,36,0.08)] text-[rgba(15,26,36,0.7)] dark:bg-white/10 dark:text-white/75',
    gold: 'bg-gold-200 text-gold-800 dark:bg-gold-800/40 dark:text-gold-200',
    demo: 'bg-violet-100/90 text-violet-900 dark:bg-violet-950/80 dark:text-violet-200',
  };
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="frost inline-flex rounded-full p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(i + 1) % options.length].value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cx(
              'min-h-11 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              size === 'sm' ? 'px-3 text-[13px]' : 'px-4 text-sm',
              active
                ? 'bg-white text-ink shadow-[0_2px_10px_rgba(31,70,110,0.15)] dark:bg-white/15'
                : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Boîte de dialogue modale accessible (piège du focus, Échap pour fermer). Plein écran en bas sur mobile. */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
        (n) => !n.hasAttribute('disabled'),
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portail vers <body> : la boîte de dialogue échappe aux contextes d'empilement (tiroir, cartes)
  return createPortal(
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-[rgba(15,26,36,0.28)] backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass glass-strong animate-rise relative flex max-h-[90dvh] w-full flex-col rounded-t-[28px] pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-card-2" aria-label={t('common.close')}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  , document.body);
}

export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-3.5' : 'size-5';
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <svg key={i} viewBox="0 0 24 24" className={s}>
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="var(--color-gold-600)" />
                <stop offset={`${fill * 100}%`} stopColor="var(--line)" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#star-${i}-${Math.round(fill * 100)})`}
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            />
          </svg>
        );
      })}
    </span>
  );
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; action?: ReactNode }) {
  const tones = {
    info: 'frost text-ink',
    warn: 'border-gold-300 bg-gold-200/70 text-gold-800 dark:border-gold-700 dark:bg-gold-800/25 dark:text-gold-200',
    error: 'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900 dark:bg-red-950/70 dark:text-red-100',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-[20px] border px-4 py-3 text-sm', tones[tone])}>
      <div>{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
