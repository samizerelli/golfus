import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PRICE_CATEGORIES, type GolfEditable, type PriceRow } from '../../../shared/types';
import { Button, Notice } from '../../components/ui';
import { api, ApiError, type PriceFinding, type SiteExtraction } from '../../lib/api';

const CAT: Record<string, string> = {
  green_fee_18: 'Green fee 18 trous',
  green_fee_9: 'Green fee 9 trous',
  twilight: 'Twilight',
  buggy: 'Voiturette',
  club_rental: 'Location de clubs',
  trolley: 'Chariot',
  range_balls: 'Balles de practice',
  lesson: 'Cours',
};
const sel = 'h-9 rounded-[10px] border border-line bg-white/70 px-1.5 text-xs dark:bg-white/5';

type Row = PriceFinding & { checked: boolean };

/**
 * Propositions relevées sur le site officiel du golf. Rien n'est publié tant que l'administrateur n'a pas
 * coché les lignes justes, cliqué « Ajouter au formulaire » puis « Enregistrer ».
 */
export function ExtractPanel({ golfId, website, golf, onApply }: { golfId: string; website: string | null; golf: GolfEditable; onApply: (patch: Partial<GolfEditable>, extractionId: number) => void }) {
  const qc = useQueryClient();
  const latest = useQuery({ queryKey: ['extraction', golfId], queryFn: () => api.admin.latestExtraction(golfId), enabled: !!golfId });
  const [data, setData] = useState<SiteExtraction | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [useContact, setUseContact] = useState({ phone: true, email: true, hours: true });

  useEffect(() => {
    if (latest.data && !data) load(latest.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest.data]);

  function load(d: SiteExtraction) {
    setData(d);
    setRows(d.prices.map((p) => ({ ...p, checked: p.suggested })));
  }

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const d = await api.admin.extract(golfId);
      load(d);
      qc.invalidateQueries({ queryKey: ['extraction', golfId] });
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'no_website' ? 'Ce golf n’a pas de site web connu : renseignez-le dans « Coordonnées ».' : 'Analyse impossible (site injoignable ou trop lent).');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!data) return;
    const today = new Date().toISOString().slice(0, 10);
    const prices: PriceRow[] = rows
      .filter((r) => r.checked && r.category !== 'other')
      .map((r) => ({ category: r.category as PriceRow['category'], season: r.season, dayType: r.dayType, amount: r.amount, currency: r.currency, note: r.label.slice(0, 200) }));
    const patch: Partial<GolfEditable> = {
      prices: [...golf.prices, ...prices],
      priceReliability: 'indicative',
      priceUpdatedAt: today,
      pricingUrl: golf.pricingUrl ?? data.pricingUrl ?? (prices.length ? rows.find((r) => r.checked)?.sourceUrl ?? null : null),
    };
    if (useContact.phone && !golf.phone && data.phones[0]) patch.phone = data.phones[0];
    if (useContact.email && !golf.email && data.emails[0]) patch.email = data.emails[0];
    if (useContact.hours && !golf.openingHours && data.openingHours) {
      patch.openingHours = data.openingHours;
    }
    onApply(patch, data.id);
  };

  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const checked = rows.filter((r) => r.checked && r.category !== 'other').length;

  return (
    <section className="glass glass-rounded space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Données du site officiel</h2>
        <Button size="sm" variant="primary" onClick={run} disabled={busy || !website}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe className="size-4" aria-hidden />}
          {data ? 'Relancer l’analyse' : 'Analyser le site officiel'}
        </Button>
      </div>
      <p className="text-sm text-muted">
        Lecture des pages publiques du site ({website ?? 'aucun site connu'}) dans le respect de son robots.txt. Les montants trouvés sont
        <strong> proposés</strong> : cochez uniquement ceux qui sont justes, vérifiez la catégorie et la saison, puis « Ajouter au formulaire »
        et « Enregistrer ». Ils seront affichés comme « tarif indicatif », avec le lien vers la page source.
      </p>
      {err && <Notice tone="error">{err}</Notice>}
      {data && (
        <>
          <p className="text-xs text-muted">
            Analyse du {new Date(data.scannedAt).toLocaleString('fr-FR')} · pages :{' '}
            {data.pages.map((p, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {new URL(p.url).pathname || '/'}
                </a>{' '}
                {p.status === 'ok' ? '✓' : p.status === 'blocked' ? '(interdit par robots.txt)' : `(erreur)`}
              </span>
            ))}
          </p>

          {rows.length === 0 ? (
            <Notice tone="warn">Aucun tarif publié trouvé sur ce site. Laissez « Tarif à confirmer » ou saisissez-les après appel au golf.</Notice>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 font-normal">Garder</th>
                    <th className="py-1 font-normal">Libellé sur le site</th>
                    <th className="py-1 font-normal">Montant</th>
                    <th className="py-1 font-normal">Catégorie</th>
                    <th className="py-1 font-normal">Saison</th>
                    <th className="py-1 font-normal">Jours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-line/60 align-top ${r.checked ? '' : 'opacity-60'}`}>
                      <td className="py-2">
                        <input type="checkbox" checked={r.checked} onChange={(e) => set(i, { checked: e.target.checked })} className="size-5 accent-fairway-700" aria-label={`Garder ${r.label}`} />
                      </td>
                      <td className="max-w-[260px] py-2 pr-2">
                        <span className="font-medium">{r.label}</span>
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" title={r.context} className="ml-1 inline-flex align-middle text-link">
                          <ExternalLink className="size-3.5" aria-label="Voir la page source" />
                        </a>
                      </td>
                      <td className="py-2 pr-2 font-semibold whitespace-nowrap tabular-nums">
                        {r.amount} {r.currency}
                      </td>
                      <td className="py-2 pr-1">
                        <select className={sel} value={r.category} onChange={(e) => set(i, { category: e.target.value })} aria-label="Catégorie">
                          <option value="other">— (ne pas importer)</option>
                          {PRICE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CAT[c]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-1">
                        <select className={sel} value={r.season} onChange={(e) => set(i, { season: e.target.value as Row['season'] })} aria-label="Saison">
                          <option value="all">Toute l’année</option>
                          <option value="low">Basse</option>
                          <option value="high">Haute</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <select className={sel} value={r.dayType} onChange={(e) => set(i, { dayType: e.target.value as Row['dayType'] })} aria-label="Jours">
                          <option value="all">Tous</option>
                          <option value="weekday">Semaine</option>
                          <option value="weekend">Week-end</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(data.phones.length > 0 || data.emails.length > 0 || data.openingHours) && (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">Coordonnées trouvées (utilisées seulement si le champ est vide) :</p>
              {data.phones[0] && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useContact.phone} onChange={(e) => setUseContact({ ...useContact, phone: e.target.checked })} className="size-4 accent-fairway-700" />
                  Téléphone : {data.phones[0]} {golf.phone && <span className="text-xs text-muted">(déjà renseigné : {golf.phone})</span>}
                </label>
              )}
              {data.emails[0] && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useContact.email} onChange={(e) => setUseContact({ ...useContact, email: e.target.checked })} className="size-4 accent-fairway-700" />
                  E-mail : {data.emails[0]}
                </label>
              )}
              {data.openingHours && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useContact.hours} onChange={(e) => setUseContact({ ...useContact, hours: e.target.checked })} className="size-4 accent-fairway-700" />
                  Horaires : <code>{data.openingHours}</code>
                </label>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={apply}>
              Ajouter au formulaire ({checked} tarif{checked > 1 ? 's' : ''})
            </Button>
            {data.id && (
              <Button variant="ghost" onClick={() => api.admin.setExtractionStatus(data.id, 'dismissed').then(() => qc.invalidateQueries({ queryKey: ['admin-extractions'] }))}>
                Ignorer cette proposition
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
