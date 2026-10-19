import { Globe2, Loader2, LocateFixed, MapPin, RotateCw, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { PlaceSuggestion } from '../../shared/types';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { getPosition, platform, type GeoErrorCode } from '../lib/geo';
import { useSearch } from '../state/search';
import { cx, haptic } from './ui';

/** Champ de recherche de lieu avec autocomplétion (motif ARIA « combobox »). */
export function LocationSearch({ trailing, className, onFocus }: { trailing?: ReactNode; className?: string; onFocus?: () => void } = {}) {
  const { t, lang } = useI18n();
  const { origin, setOrigin } = useSearch();
  const [text, setText] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (origin?.source === 'search' && origin.label) setText(origin.label);
    if (origin?.source === 'gps' || origin?.source === 'ip') setText('');
  }, [origin]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === origin?.label) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .autocomplete(q, lang, ctrl.signal)
        .then((r) => {
          setItems(r);
          setError(false);
          setActive(-1);
        })
        .catch((e) => {
          if (e?.code !== 'network' || !ctrl.signal.aborted) setError(true);
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, lang, origin?.label]);

  const choose = (s: PlaceSuggestion) => {
    setOrigin({ lat: s.lat, lon: s.lon, label: s.label, source: 'search' });
    setText(s.label);
    setOpen(false);
    setItems([]);
    inputRef.current?.blur();
  };

  const showList = open && text.trim().length >= 2 && text !== origin?.label;

  return (
    <div className={cx('relative', className)}>
      <label htmlFor="place-search" className="sr-only">
        {t('search.label')}
      </label>
      <div className="glass glass-refract flex h-14 items-center gap-2 rounded-full pr-1.5 pl-4 transition-shadow duration-300 focus-within:shadow-[0_0_0_3px_rgba(127,182,230,0.55),0_8px_32px_rgba(31,70,110,0.16)]">
        <Search className="size-5 shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id="place-search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t('search.placeholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            onFocus?.();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === 'Enter') {
              const s = items[active >= 0 ? active : 0];
              if (s) {
                e.preventDefault();
                choose(s);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
        />
        {loading && <Loader2 className="size-4 animate-spin text-muted" aria-label={t('search.searching')} />}
        {text && !loading && (
          <button
            type="button"
            onClick={() => {
              setText('');
              inputRef.current?.focus();
            }}
            className="grid size-11 place-items-center rounded-full text-muted hover:text-ink"
            aria-label={t('search.clear')}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        {trailing && (
          <>
            <span className="h-6 w-px bg-[var(--line)]" aria-hidden />
            {trailing}
          </>
        )}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('search.label')}
          className="glass glass-strong animate-rise absolute inset-x-0 top-full z-[1400] mt-2 max-h-[min(20rem,50dvh)] overflow-y-auto rounded-[24px] py-1.5"
        >
          {error && <li className="px-4 py-3 text-sm text-muted">{t('search.geocoderDown')}</li>}
          {!error && !loading && items.length === 0 && <li className="px-4 py-3 text-sm text-muted">{t('search.noSuggestions')}</li>}
          {items.map((s, i) => (
            <li
              key={`${s.lat},${s.lon},${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={cx('mx-1.5 flex min-h-11 cursor-pointer items-start gap-3 rounded-[16px] px-3 py-2.5', i === active && 'bg-white/70 dark:bg-white/10')}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-glacier-600" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.label}</span>
                {s.sublabel && <span className="block truncate text-sm text-muted">{s.sublabel}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useLocate() {
  const { lang } = useI18n();
  const { setOrigin } = useSearch();
  const [busy, setBusy] = useState(false);
  const [ipBusy, setIpBusy] = useState(false);
  const [error, setError] = useState<GeoErrorCode | 'ipFailed' | null>(null);

  const locate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const p = await getPosition();
      haptic(12);
      setOrigin({ ...p, label: null, source: 'gps' });
      // Nom de ville approximatif, uniquement pour l'affichage
      api
        .reverse(p.lat, p.lon, lang)
        .then((r) => r.label && setOrigin({ ...p, label: r.label, source: 'gps' }))
        .catch(() => undefined);
    } catch (e) {
      setError(typeof e === 'string' ? (e as GeoErrorCode) : 'unavailable');
    } finally {
      setBusy(false);
    }
  };

  /** Repli : position approximative par adresse IP (à la demande uniquement) */
  const locateByIp = async () => {
    setIpBusy(true);
    try {
      const r = await api.geoip();
      haptic(12);
      setOrigin({ lat: r.lat, lon: r.lon, label: r.city ?? r.country ?? null, source: 'ip' });
      setError(null);
    } catch {
      setError('ipFailed');
    } finally {
      setIpBusy(false);
    }
  };

  return { locate, locateByIp, busy, ipBusy, error, clearError: () => setError(null) };
}

/** Bouton « Me localiser » intégré à la barre de recherche */
export function LocateInline({ loc }: { loc: ReturnType<typeof useLocate> }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={loc.locate}
      aria-busy={loc.busy}
      aria-label={loc.busy ? t('search.locating') : t('search.locate')}
      title={t('search.locate')}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-fairway-700 px-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 dark:bg-fairway-300 dark:text-fairway-950"
    >
      {loc.busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
      <span className="hidden min-[400px]:inline">{loc.busy ? t('search.locating') : t('search.locate')}</span>
    </button>
  );
}

/** Message d'erreur de localisation + solutions de repli (saisie d'une ville, position par IP) */
export function LocateError({ loc }: { loc: ReturnType<typeof useLocate> }) {
  const { t } = useI18n();
  if (!loc.error) return null;
  const help =
    loc.error === 'denied'
      ? t(platform() === 'ios' ? 'geo.deniedIos' : platform() === 'android' ? 'geo.deniedAndroid' : 'geo.deniedDesktop')
      : null;
  const pillBtn = 'frost glass-interactive inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap';
  return (
    <div role="alert" className="glass glass-strong animate-rise rounded-[24px] p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-semibold">{loc.error === 'ipFailed' ? t('geo.ipFailed') : t(`geo.${loc.error}`)}</p>
          {help && <p className="text-muted">{help}</p>}
        </div>
        <button type="button" onClick={loc.clearError} className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full" aria-label={t('common.close')}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          className={pillBtn}
          onClick={() => {
            loc.clearError();
            document.getElementById('place-search')?.focus();
          }}
        >
          <Search className="size-4" aria-hidden />
          {t('geo.typeCity')}
        </button>
        {loc.error !== 'ipFailed' && (
          <button type="button" className={pillBtn} onClick={loc.locateByIp} aria-busy={loc.ipBusy} title={t('geo.ipNote')}>
            {loc.ipBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe2 className="size-4" aria-hidden />}
            {loc.ipBusy ? t('geo.ipLoading') : t('geo.useIp')}
          </button>
        )}
        {loc.error !== 'denied' && loc.error !== 'insecure' && loc.error !== 'unsupported' && loc.error !== 'ipFailed' && (
          <button type="button" className={pillBtn} onClick={loc.locate}>
            <RotateCw className="size-4" aria-hidden />
            {t('geo.retry')}
          </button>
        )}
      </div>
      {loc.error !== 'ipFailed' && <p className="mt-2 text-xs text-muted">{t('geo.ipNote')}</p>}
    </div>
  );
}
