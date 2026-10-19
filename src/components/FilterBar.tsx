import { CalendarClock, ChevronDown, Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RADII_KM, type RadiusKm, type ServiceKey } from '../../shared/types';
import { useI18n } from '../i18n';
import { useSearch, type SortKey } from '../state/search';
import { FiltersButton } from './Filters';
import { GlassPill } from './glass';
import { Button, cx, Dialog, haptic } from './ui';

const pill =
  'glass glass-interactive inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold whitespace-nowrap';
const pillOn =
  '!bg-fairway-700 !text-white !border-fairway-700 shadow-[0_6px_18px_rgba(31,93,74,0.3)] dark:!bg-fairway-300 dark:!text-fairway-950 dark:!border-fairway-300';

function TogglePill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <GlassPill
      aria-pressed={on}
      active={on}
      onClick={() => {
        haptic();
        onClick();
      }}
    >
      {on && <Check className="size-4" aria-hidden />}
      {children}
    </GlassPill>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function PlayTimePill() {
  const { t, locale } = useI18n();
  const { playAt, isNow, setPlay, playDate, playTime } = useSearch();
  const [open, setOpen] = useState(false);
  const summary = isNow
    ? t('search.now')
    : playAt.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <GlassPill onClick={() => setOpen(true)} active={!isNow} aria-haspopup="dialog">
        <CalendarClock className="size-4" aria-hidden />
        <span className="sr-only">{t('search.when')} : </span>
        {summary}
      </GlassPill>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('search.when')}
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setPlay(null, null)} disabled={isNow}>
              {t('search.resetNow')}
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              {t('filters.done')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 pb-2">
          <label className="flex flex-col text-sm font-medium">
            {t('search.date')}
            <input
              type="date"
              min={toDateInput(new Date())}
              value={playDate ?? toDateInput(playAt)}
              onChange={(e) => setPlay(e.target.value || null, playTime ?? '10:00')}
              className="frost mt-1.5 h-12 rounded-[16px] px-3 text-base text-ink"
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            {t('search.time')}
            <input
              type="time"
              step={900}
              value={playTime ?? toTimeInput(playAt)}
              onChange={(e) => setPlay(playDate ?? toDateInput(playAt), e.target.value || null)}
              className="frost mt-1.5 h-12 rounded-[16px] px-3 text-base text-ink"
            />
          </label>
        </div>
      </Dialog>
    </>
  );
}

function RadiusPill() {
  const { t } = useI18n();
  const { radius, setRadius } = useSearch();
  return (
    <label className={cx(pill, 'relative pr-9')}>
      <span className="sr-only">{t('search.radius')}</span>
      <select
        value={radius}
        onChange={(e) => setRadius(Number(e.target.value) as RadiusKm)}
        className="absolute -inset-px cursor-pointer appearance-none rounded-full opacity-0"
      >
        {RADII_KM.map((r) => (
          <option key={r} value={r}>
            {r} km
          </option>
        ))}
      </select>
      <span aria-hidden>{radius} km</span>
      <ChevronDown className="absolute right-3 size-4 text-muted" aria-hidden />
    </label>
  );
}

const SERVICE_PILLS: ServiceKey[] = ['buggy', 'clubRental', 'drivingRange', 'restaurant'];

/** Barre de filtres : pastilles de verre défilantes. */
export function FilterBar({ className, withSort = true }: { className?: string; withSort?: boolean }) {
  const { t } = useI18n();
  const { sort, setSort, filters, setFilters } = useSearch();
  const setHoles = (h: '9' | '18') => setFilters({ ...filters, holes: filters.holes === h ? 'any' : h });
  const toggleService = (k: ServiceKey) =>
    setFilters({ ...filters, services: filters.services.includes(k) ? filters.services.filter((s) => s !== k) : [...filters.services, k] });

  return (
    <div className={cx('no-scrollbar flex gap-2 overflow-x-auto py-1', className)}>
      <RadiusPill />
      <PlayTimePill />
      {withSort && (
        <div role="radiogroup" aria-label={t('sort.label')} className="flex shrink-0 gap-2">
          {(['distance', 'price', 'rating'] as SortKey[]).map((k) => (
            <GlassPill
              key={k}
              role="radio"
              aria-checked={sort === k}
              active={sort === k}
              onClick={() => {
                haptic();
                setSort(k);
              }}
            >
              {t(`sort.${k}`)}
            </GlassPill>
          ))}
        </div>
      )}
      <TogglePill on={filters.holes === '9'} onClick={() => setHoles('9')}>
        {t('filters.holes9')}
      </TogglePill>
      <TogglePill on={filters.holes === '18'} onClick={() => setHoles('18')}>
        {t('filters.holes18')}
      </TogglePill>
      <TogglePill on={filters.openAtTime} onClick={() => setFilters({ ...filters, openAtTime: !filters.openAtTime })}>
        {t('hours.open')}
      </TogglePill>
      {SERVICE_PILLS.map((k) => (
        <TogglePill key={k} on={filters.services.includes(k)} onClick={() => toggleService(k)}>
          {t(`service.${k}`)}
        </TogglePill>
      ))}
      <FiltersButton pillClass={pill} pillOnClass={pillOn} />
    </div>
  );
}
