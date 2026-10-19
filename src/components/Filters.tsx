import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { ServiceKey } from '../../shared/types';
import { useI18n } from '../i18n';
import { useSettings } from '../lib/settings';
import { activeFilterCount, DEFAULT_FILTERS, useSearch, type Filters, type HolesFilter } from '../state/search';
import { Button, cx, Dialog, Segmented } from './ui';

const FILTER_SERVICES: ServiceKey[] = ['clubRental', 'drivingRange', 'restaurant', 'buggy'];
const PRICE_STEPS = [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];

export function FiltersButton({ pillClass, pillOnClass }: { pillClass?: string; pillOnClass?: string } = {}) {
  const { t } = useI18n();
  const { filters, setFilters } = useSearch();
  const { currency, convert, money } = useSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);
  const n = activeFilterCount(filters);

  // Le curseur de prix est gradué dans la devise choisie ; la valeur est stockée en EUR
  const toEur = (v: number) => convert(v, currency, 'EUR') ?? v;
  const fromEur = (v: number) => convert(v, 'EUR', currency) ?? v;
  const stepIndex = draft.maxPriceEur === null ? PRICE_STEPS.length : PRICE_STEPS.findIndex((s) => s >= Math.round(fromEur(draft.maxPriceEur!)));

  const toggleService = (k: ServiceKey) =>
    setDraft((d) => ({ ...d, services: d.services.includes(k) ? d.services.filter((s) => s !== k) : [...d.services, k] }));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
        className={
          pillClass
            ? cx(pillClass, n > 0 && pillOnClass)
            : cx(
                'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium',
                n ? 'border-fairway-700 bg-fairway-700 text-white dark:border-fairway-300 dark:bg-fairway-300 dark:text-fairway-950' : 'frost',
              )
        }
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {n ? t('filters.open', { n }) : t('filters.more')}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('filters.title')}
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setDraft(DEFAULT_FILTERS)}>
              {t('filters.reset')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setFilters(draft);
                setOpen(false);
              }}
            >
              {t('filters.done')}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="max-price" className="flex items-baseline justify-between text-sm font-semibold">
              {t('filters.maxPrice')}
              <span className="font-display text-lg text-ink">
                {draft.maxPriceEur === null ? t('filters.noMax') : money(Math.round(fromEur(draft.maxPriceEur)), currency).text}
              </span>
            </label>
            <input
              id="max-price"
              type="range"
              min={0}
              max={PRICE_STEPS.length}
              step={1}
              value={stepIndex < 0 ? PRICE_STEPS.length : stepIndex}
              aria-valuetext={draft.maxPriceEur === null ? t('filters.noMax') : money(Math.round(fromEur(draft.maxPriceEur)), currency).text}
              onChange={(e) => {
                const i = Number(e.target.value);
                setDraft((d) => ({ ...d, maxPriceEur: i >= PRICE_STEPS.length ? null : toEur(PRICE_STEPS[i]) }));
              }}
              className="mt-3 h-11 w-full accent-fairway-700 dark:accent-fairway-300"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('filters.holes')}</legend>
            <Segmented<HolesFilter>
              label={t('filters.holes')}
              value={draft.holes}
              onChange={(v) => setDraft((d) => ({ ...d, holes: v }))}
              options={[
                { value: 'any', label: t('filters.holesAny') },
                { value: '9', label: t('filters.holes9') },
                { value: '18', label: t('filters.holes18') },
              ]}
            />
          </fieldset>

          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {t('filters.openAtTime')}
            <input
              type="checkbox"
              role="switch"
              checked={draft.openAtTime}
              onChange={(e) => setDraft((d) => ({ ...d, openAtTime: e.target.checked }))}
              className="size-6 accent-fairway-700 dark:accent-fairway-300"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('filters.services')}</legend>
            <div className="flex flex-wrap gap-2">
              {FILTER_SERVICES.map((k) => {
                const on = draft.services.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleService(k)}
                    className={cx(
                      'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors duration-300',
                      on ? 'border-fairway-700 bg-fairway-700 text-white dark:border-fairway-300 dark:bg-fairway-300 dark:text-fairway-950' : 'frost',
                    )}
                  >
                    {t(`service.${k}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-muted">{t('filters.unknownHidden')}</p>
        </div>
      </Dialog>
    </>
  );
}
