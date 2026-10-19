import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Currency, RatesResponse } from '../../shared/types';
import { useI18n } from '../i18n';
import { api } from './api';
import { readStore, writeStore } from './storage';

export type Theme = 'system' | 'light' | 'dark';

interface Ctx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: RatesResponse | null;
  /** Convertit un montant ; renvoie null si les taux ne sont pas disponibles */
  convert: (amount: number, from: Currency, to?: Currency) => number | null;
  /** Formate un montant dans la devise choisie (ou la devise d'origine si la conversion est impossible) */
  money: (amount: number, from: Currency) => { text: string; converted: boolean; original: string };
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [theme, setThemeState] = useState<Theme>(() => readStore<Theme>('gf.theme', 'system'));
  const [currency, setCurrencyState] = useState<Currency>(() => readStore<Currency>('gf.currency', 'EUR'));
  const { data: rates = null } = useQuery({ queryKey: ['rates'], queryFn: api.rates, staleTime: 6 * 3600_000, retry: 1 });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1219' : '#f5f9fc');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeStore('gf.theme', t);
  }, []);
  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    writeStore('gf.currency', c);
  }, []);

  const value = useMemo<Ctx>(() => {
    const convert = (amount: number, from: Currency, to: Currency = currency) => {
      if (from === to) return amount;
      if (!rates) return null;
      return (amount / rates.rates[from]) * rates.rates[to];
    };
    const fmt = (n: number, c: Currency) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: c, maximumFractionDigits: n % 1 === 0 || n >= 100 ? 0 : 2 }).format(n);
    const money = (amount: number, from: Currency) => {
      const original = fmt(amount, from);
      const c = convert(amount, from);
      if (c === null || from === currency) return { text: original, converted: false, original };
      return { text: `≈ ${fmt(Math.round(c), currency)}`, converted: true, original };
    };
    return { theme, setTheme, currency, setCurrency, rates, convert, money };
  }, [theme, setTheme, currency, setCurrency, rates, locale]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings hors du SettingsProvider');
  return ctx;
}
