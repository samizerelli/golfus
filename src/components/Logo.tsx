import { cx } from './ui';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a3cbee" />
          <stop offset="1" stopColor="#3f7fb5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#logo-bg)" />
      <rect width="64" height="32" rx="18" fill="#fff" opacity=".18" />
      <path d="M26 48V14l17 7-17 7" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="32" cy="49" rx="14" ry="3.5" fill="#1f5d4a" />
    </svg>
  );
}
