import type { Currency, RatesResponse } from '../../shared/types.ts';
import { cached } from '../lib/cache.ts';
import { fetchJson } from '../lib/http.ts';

/** Taux de change de référence de la BCE via Frankfurter (gratuit, sans clé). */
export async function getRates(): Promise<RatesResponse> {
  const { value } = await cached('rates:eur', async () => {
    const data = await fetchJson<{ date: string; rates: Partial<Record<Currency, number>> }>(
      'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CHF,USD,GBP',
      { timeoutMs: 8000 },
    );
    const { CHF, USD, GBP } = data.rates;
    if (!CHF || !USD || !GBP) throw new Error('Taux incomplets');
    return { base: 'EUR' as const, date: data.date, rates: { EUR: 1, CHF, USD, GBP } };
  });
  return value;
}
