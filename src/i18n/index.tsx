import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readStore, writeStore } from '../lib/storage';
import { en } from './en';
import { es } from './es';
import { fr, type Dict, type DictKey } from './fr';

export const LANGS = ['fr', 'en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
const DICTS: Record<Lang, Dict> = { fr, en, es };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };

type Vars = Record<string, string | number>;
type TFn = (key: DictKey, vars?: Vars) => string;
/** Clés de base pour lesquelles il existe des variantes _one / _other */
type PluralBase<K> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<DictKey>;

interface Ctx {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: TFn;
  tp: (key: PluralKey, n: number, vars?: Vars) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  const saved = readStore<Lang | null>('gf.lang', null);
  if (saved && LANGS.includes(saved)) return saved;
  return 'fr';
}

function interpolate(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const locale = LOCALES[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStore('gf.lang', l);
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang];
    const t: TFn = (key, vars) => interpolate(dict[key] ?? fr[key] ?? key, vars);
    const rules = new Intl.PluralRules(locale);
    const tp = (key: PluralKey, n: number, vars?: Vars) => {
      const form = rules.select(n) === 'one' ? 'one' : 'other';
      return t(`${key}_${form}` as DictKey, { n, ...vars });
    };
    return { lang, locale, setLang, t, tp };
  }, [lang, locale, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n hors du I18nProvider');
  return ctx;
}
