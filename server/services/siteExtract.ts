/**
 * Extraction de données factuelles depuis le site officiel d'un golf (tarifs, horaires, coordonnées).
 *
 * Règles :
 * - respect de robots.txt, User-Agent identifiable, 4 pages au maximum par site, ~9 s au total ;
 * - seules des données factuelles sont relevées (montants, horaires, téléphone, e-mail) — jamais les photos ni les textes ;
 * - rien n'est publié automatiquement : les propositions sont validées par un administrateur (une page peut
 *   mélanger green fees, abonnements et cours, l'attribution d'un montant peut être ambiguë).
 */
import type { PriceCategory, Season, DayType } from '../../shared/types.ts';
import { fetchText } from '../lib/fetchText.ts';
import { robotsAllows } from '../lib/robots.ts';

export interface PriceFinding {
  amount: number;
  currency: 'EUR' | 'CHF' | 'USD' | 'GBP';
  label: string;
  context: string;
  category: PriceCategory | 'other';
  season: Season;
  dayType: DayType;
  /** Proposé coché par défaut (catégorie reconnue et pas un tarif spécial : junior, abonnement…) */
  suggested: boolean;
  sourceUrl: string;
}

export interface Extraction {
  site: string;
  scannedAt: string;
  pages: { url: string; status: 'ok' | 'blocked' | 'error'; note?: string }[];
  prices: PriceFinding[];
  phones: string[];
  emails: string[];
  openingHours: string | null;
  pricingUrl: string | null;
}

const PRICE_LINK = /(tarif|precio|rate|price|green[-_ ]?fee|fees|preise|prijzen|tarieven)/i;
const HOURS_LINK = /(horaire|horario|opening|hours|contact|contacto|öffnungs)/i;

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d)>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

const CURRENCY: Record<string, PriceFinding['currency']> = { '€': 'EUR', eur: 'EUR', euros: 'EUR', chf: 'CHF', 'fr.': 'CHF', $: 'USD', usd: 'USD', '£': 'GBP', gbp: 'GBP' };

function classify(label: string, before: string): Pick<PriceFinding, 'category' | 'season' | 'dayType' | 'suggested'> {
  const l = label.toLowerCase();
  const b = before.toLowerCase();
  const special = /(junior|niñ|enfant|child|senior|pro\b|profesional|socio|member|abonn|abono|annual|anual|bono|block|ticket|carnet|pack|torneo|tournament|alquiler de taquilla|locker)/.test(l);
  let category: PriceFinding['category'] = 'other';
  if (/twilight|crepuscul|tarde|afternoon|après-midi/.test(l)) category = 'twilight';
  else if (/alquiler de palos|club hire|club rental|location de clubs|rental clubs|palos/.test(l)) category = 'club_rental';
  else if (/buggy|voiturette|cart\b|coche/.test(l) && !/green/.test(l)) category = 'buggy';
  else if (/trolley|carrito|chariot/.test(l)) category = 'trolley';
  else if (/bolas|range balls|balles|bucket|cubo/.test(l)) category = 'range_balls';
  else if (/clase|lesson|cours|lección/.test(l)) category = 'lesson';
  else if (/\b9\s*(hoyos|holes|trous|löcher)/.test(l)) category = 'green_fee_9';
  else if (/green\s?-?fee|\b18\s*(hoyos|holes|trous|löcher)|green/.test(l)) category = 'green_fee_18';
  const ctx = `${b} ${l}`;
  const season: Season = /(temporada alta|high season|haute saison|peak|hochsaison)/.test(ctx)
    ? 'high'
    : /(temporada baja|low season|basse saison|off.?peak|nebensaison)/.test(ctx)
      ? 'low'
      : 'all';
  const dayType: DayType = /(fin de semana|weekend|week-end|sábado|samedi|saturday|festivo)/.test(l)
    ? 'weekend'
    : /(laborable|weekday|semaine|lunes a viernes|monday to friday|entre semana)/.test(l)
      ? 'weekday'
      : 'all';
  return { category, season, dayType, suggested: category !== 'other' && !special };
}

/** Montants avec devise + libellé qui les précède (« Greenfee 18 hoyos + buggy: 139€ »). */
export function findPrices(text: string, sourceUrl: string): PriceFinding[] {
  const out: PriceFinding[] = [];
  const re = /(?:(€|£|\$|CHF|EUR)\s?(\d{1,4}(?:[.,]\d{1,2})?))|(?:(\d{1,4}(?:[.,]\d{1,2})?)\s?(€|£|\$|CHF|EUR|euros|Fr\.))/gi;
  for (const m of text.matchAll(re)) {
    const num = (m[2] ?? m[3]).replace(',', '.');
    const cur = CURRENCY[(m[1] ?? m[4]).toLowerCase()] ?? 'EUR';
    const amount = Number(num);
    if (!Number.isFinite(amount) || amount < 5 || amount > 2000) continue;
    const start = m.index!;
    // Libellé : texte depuis le dernier séparateur (« | », « . », montant précédent) jusqu'au montant
    const before = text.slice(Math.max(0, start - 300), start);
    const seg = before.split(/\||\d+(?:[.,]\d+)?\s?(?:€|£|\$|CHF|EUR)|(?:€|£|\$)\s?\d+/).pop() ?? '';
    const label = seg.replace(/[:\-–—]\s*$/, '').trim().slice(-90);
    if (!label || label.length < 3) continue;
    out.push({
      amount,
      currency: cur,
      label,
      context: text.slice(Math.max(0, start - 120), start + m[0].length + 40).trim(),
      sourceUrl,
      ...classify(label, before),
    });
  }
  // Doublons exacts (même libellé, même montant)
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p.label}|${p.amount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const DAYS: Record<string, string> = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };

/** Horaires depuis les données structurées schema.org (format compatible OSM opening_hours). */
function hoursFromJsonLd(nodes: Record<string, unknown>[]): string | null {
  for (const n of nodes) {
    if (typeof n.openingHours === 'string') return n.openingHours;
    if (Array.isArray(n.openingHours)) return n.openingHours.join('; ');
    const spec = n.openingHoursSpecification;
    if (Array.isArray(spec) && spec.length) {
      const parts = spec
        .map((s: Record<string, unknown>) => {
          const days = ([] as string[])
            .concat((s.dayOfWeek as string | string[]) ?? [])
            .map((d) => DAYS[String(d).split('/').pop()!.toLowerCase()])
            .filter(Boolean);
          const o = String(s.opens ?? '').slice(0, 5);
          const c = String(s.closes ?? '').slice(0, 5);
          return days.length && /^\d\d:\d\d$/.test(o) && /^\d\d:\d\d$/.test(c) ? `${days.join(',')} ${o}-${c}` : null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
  }
  return null;
}

function jsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]);
      const walk = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === 'object') {
          nodes.push(x as Record<string, unknown>);
          if ('@graph' in (x as object)) walk((x as { '@graph': unknown })['@graph']);
        }
      };
      walk(d);
    } catch {
      /* JSON-LD invalide : ignoré */
    }
  }
  return nodes;
}

export async function extractFromSite(siteUrl: string, budgetMs = 9000): Promise<Extraction> {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const result: Extraction = { site: siteUrl, scannedAt: new Date().toISOString(), pages: [], prices: [], phones: [], emails: [], openingHours: null, pricingUrl: null };
  const phones = new Set<string>();
  const emails = new Set<string>();

  const scan = async (url: string) => {
    const u = new URL(url);
    if (!(await robotsAllows(u))) {
      result.pages.push({ url, status: 'blocked', note: 'robots.txt' });
      return null;
    }
    try {
      const { body, finalUrl } = await fetchText(url, { timeoutMs: Math.min(4000, Math.max(1000, left())) });
      result.pages.push({ url: finalUrl, status: 'ok' });
      for (const m of body.matchAll(/href="tel:([+\d\s().-]{6,25})"/gi)) phones.add(m[1].trim());
      for (const m of body.matchAll(/href="mailto:([^"?]+@[^"?]+)"/gi)) emails.add(decodeURIComponent(m[1]).trim().toLowerCase());
      const nodes = jsonLdNodes(body);
      for (const n of nodes) {
        if (typeof n.telephone === 'string') phones.add(n.telephone);
        if (typeof n.email === 'string') emails.add(n.email.replace(/^mailto:/, '').toLowerCase());
      }
      result.openingHours ??= hoursFromJsonLd(nodes);
      const prices = findPrices(htmlToText(body), finalUrl);
      if (prices.some((p) => p.suggested) && !result.pricingUrl) result.pricingUrl = finalUrl;
      result.prices.push(...prices);
      return { body, finalUrl };
    } catch (e) {
      result.pages.push({ url, status: 'error', note: (e as Error).message });
      return null;
    }
  };

  const home = await scan(siteUrl);
  if (home) {
    const base = new URL(home.finalUrl);
    const links = [...home.body.matchAll(/href="([^"#]+)"/gi)]
      .map((m) => {
        try {
          return new URL(m[1], base);
        } catch {
          return null;
        }
      })
      .filter((u): u is URL => !!u && u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && !/\.(pdf|jpe?g|png|webp|zip)$/i.test(u.pathname));
    const unique = [...new Map(links.map((u) => [u.origin + u.pathname, u])).values()];
    const priceLinks = unique.filter((u) => PRICE_LINK.test(u.pathname)).slice(0, 2);
    const hourLinks = unique.filter((u) => HOURS_LINK.test(u.pathname) && !priceLinks.includes(u)).slice(0, 1);
    for (const u of [...priceLinks, ...hourLinks]) {
      if (left() < 1500) break;
      await new Promise((r) => setTimeout(r, 300)); // politesse entre deux pages du même site
      await scan(u.href);
    }
  }
  result.phones = [...phones].slice(0, 3);
  result.emails = [...emails].filter((e) => !/example|wixpress|sentry/.test(e)).slice(0, 3);
  result.prices = result.prices.slice(0, 40);
  return result;
}
