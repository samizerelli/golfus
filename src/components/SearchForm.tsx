import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RADII_KM, type RadiusKm } from '../../shared/types';
import { useI18n } from '../i18n';
import { todayStr, useSearch, type HolesFilter } from '../state/search';
import { LocateError, LocateInline, LocationSearch, useLocate } from './SearchControls';
import { cx, haptic, Segmented } from './ui';

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const MIN = 6 * 60;
const MAX = 21 * 60;
const STEP = 30;

function Field({ label, htmlFor, children, aside }: { label: string; htmlFor?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            {label}
          </label>
        ) : (
          <span className="text-[13px] font-semibold tracking-wide text-muted uppercase">{label}</span>
        )}
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Curseur à deux poignées (deux curseurs natifs superposés : clavier et lecteurs d'écran compris). */
export function TimeRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const { t } = useI18n();
  const a = toMin(from);
  const b = toMin(to);
  const pct = (m: number) => ((m - MIN) / (MAX - MIN)) * 100;
  const thumb =
    'pointer-events-none absolute inset-x-0 top-1/2 h-11 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-fairway-700 [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.25)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-fairway-700';
  return (
    <div>
      <div className="relative h-11">
        <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-card-2" aria-hidden>
          <div className="absolute h-full rounded-full bg-gradient-to-r from-glacier-400 to-fairway-500" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={a}
          aria-label={t('s1.timeStart')}
          aria-valuetext={from}
          onChange={(e) => onChange(toHHMM(Math.min(Number(e.target.value), b - STEP)), to)}
          className={thumb}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={b}
          aria-label={t('s1.timeEnd')}
          aria-valuetext={to}
          onChange={(e) => onChange(from, toHHMM(Math.max(Number(e.target.value), a + STEP)))}
          className={thumb}
        />
      </div>
      <div className="flex justify-between text-xs text-muted tabular-nums" aria-hidden>
        <span>06:00</span>
        <span>21:00</span>
      </div>
    </div>
  );
}

/** Sélecteur de note minimale : 0 (toutes) à 5 étoiles. */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={t('s1.rating')} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('s1.ratingMin', { n })}
          onMouseEnter={() => setHover(n)}
          onClick={() => {
            haptic();
            onChange(value === n ? 0 : n);
          }}
          className="grid size-11 place-items-center rounded-full text-[28px] leading-none transition-transform active:scale-90"
        >
          <span aria-hidden className={n <= shown ? 'text-gold-600' : 'text-[rgba(15,26,36,0.18)] dark:text-white/20'}>
            ★
          </span>
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === 0}
        onClick={() => onChange(0)}
        className={cx('ml-1 h-11 rounded-full px-3 text-sm font-medium', value === 0 ? 'bg-white text-ink shadow-sm dark:bg-white/15' : 'text-muted')}
      >
        {t('s1.ratingAny')}
      </button>
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 8, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="frost inline-flex items-center gap-1 rounded-full p-1" role="group" aria-label={label}>
      <button type="button" className="grid size-11 place-items-center rounded-full disabled:opacity-40" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} −1`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value >= max ? `${max}+` : value}
      </output>
      <button type="button" className="grid size-11 place-items-center rounded-full disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} +1`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Filtres de la partie : chaque changement met à jour la liste des golfs disponibles (pas de bouton à valider). */
export function SearchForm() {
  const { t } = useI18n();
  const { criteria: c, setCriteria, radius, setRadius, setView } = useSearch();
  const loc = useLocate();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setView('home')} className="glass glass-interactive grid size-11 shrink-0 place-items-center rounded-full" aria-label={t('s1.backHome')}>
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-[24px] leading-tight">{t('s1.title')}</h1>
      </div>

      <Field
        label={t('s1.location')}
        aside={
          <label className="flex items-center gap-1 text-xs text-muted">
            {t('s1.radius')}
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value) as RadiusKm)} className="h-8 rounded-full bg-transparent px-1 text-sm font-semibold text-ink">
              {RADII_KM.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
        }
      >
        <LocationSearch trailing={<LocateInline loc={loc} />} />
        <LocateError loc={loc} />
      </Field>

      <Field label={t('s1.date')} htmlFor="play-date">
        <input
          id="play-date"
          type="date"
          min={todayStr()}
          value={c.date}
          onChange={(e) => e.target.value && setCriteria({ date: e.target.value })}
          className="frost h-12 w-full rounded-[16px] px-4 text-base text-ink"
        />
      </Field>

      <Field label={t('s1.timeRange')} aside={<span className="text-sm font-semibold tabular-nums">{`${c.timeFrom} – ${c.timeTo}`}</span>}>
        <TimeRange from={c.timeFrom} to={c.timeTo} onChange={(timeFrom, timeTo) => setCriteria({ timeFrom, timeTo })} />
      </Field>

      <Field label={t('s1.holes')}>
        <Segmented<HolesFilter>
          label={t('s1.holes')}
          value={c.holes}
          onChange={(holes) => setCriteria({ holes })}
          options={[
            { value: 'any', label: t('s1.holesAny') },
            { value: '9', label: t('filters.holes9') },
            { value: '18', label: t('filters.holes18') },
          ]}
        />
      </Field>

      <Field label={t('s1.rating')}>
        <StarPicker value={c.minRating} onChange={(minRating) => setCriteria({ minRating })} />
      </Field>

      <Field label={t('s1.players')}>
        <Stepper label={t('s1.players')} value={c.players} onChange={(players) => setCriteria({ players })} />
      </Field>

    </form>
  );
}
