import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Globe, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RADII_KM, type GolfSummary, type PlaceSuggestion, type RadiusKm } from '../../../shared/types';
import { Button, Notice } from '../../components/ui';
import { api } from '../../lib/api';

const input = 'h-11 w-full rounded-[14px] border border-line bg-white/70 px-3 text-sm text-ink dark:bg-white/5';

interface RunState {
  status: 'waiting' | 'running' | 'done' | 'error';
  found?: number;
  suggested?: number;
  note?: string;
}

/**
 * Collecte par zone : analyse les sites officiels des golfs d'une zone (un golf à la fois, pour rester poli
 * avec les sites et sous la limite de durée des fonctions), puis file de vérification des propositions.
 */
export function AdminCollect() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [radius, setRadius] = useState<RadiusKm>(25);
  const [golfs, setGolfs] = useState<GolfSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<Record<string, RunState>>({});
  const [running, setRunning] = useState(false);
  const pending = useQuery({ queryKey: ['admin-extractions'], queryFn: () => api.admin.extractions('pending') });

  const findPlaces = async () => {
    if (q.trim().length < 2) return;
    setPlaces(await api.autocomplete(q.trim(), 'fr').catch(() => []));
  };
  const listGolfs = async (p: PlaceSuggestion) => {
    setPlace(p);
    setPlaces([]);
    setLoading(true);
    try {
      const r = await api.golfs(p.lat, p.lon, radius);
      setGolfs(r.golfs.filter((g) => g.website && !g.isDemo));
      setState({});
    } finally {
      setLoading(false);
    }
  };

  // Golfs sans tarifs et sans proposition déjà en attente (une relance ne refait pas le travail)
  const pendingIds = new Set((pending.data ?? []).map((e) => e.golfId));
  const targets = (golfs ?? []).filter((g) => g.prices.length === 0 && !pendingIds.has(g.id));
  const run = async () => {
    setRunning(true);
    for (const g of targets) {
      setState((s) => ({ ...s, [g.id]: { status: 'running' } }));
      try {
        const r = await api.admin.extract(g.id);
        setState((s) => ({ ...s, [g.id]: { status: 'done', found: r.prices.length, suggested: r.prices.filter((p) => p.suggested).length } }));
      } catch {
        setState((s) => ({ ...s, [g.id]: { status: 'error', note: 'site injoignable ou trop lent' } }));
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setRunning(false);
    qc.invalidateQueries({ queryKey: ['admin-extractions'] });
  };
  const done = Object.values(state).filter((s) => s.status === 'done' || s.status === 'error').length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Link to="/admin" className="text-sm text-muted underline underline-offset-2">
        ← Administration
      </Link>
      <h1 className="text-3xl font-semibold">Collecte depuis les sites officiels</h1>
      <Notice>
        Pour chaque golf de la zone qui a un site web et pas encore de tarifs, l’outil lit quelques pages publiques (tarifs, contact) en
        respectant robots.txt, puis enregistre des <strong>propositions</strong>. Rien n’est publié sans votre vérification dans la fiche du golf.
      </Notice>

      <section className="glass glass-rounded space-y-3 p-5">
        <h2 className="text-xl font-semibold">1. Choisir une zone</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            findPlaces();
          }}
        >
          <input className={`${input} min-w-0 flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ville ou région (ex. Marbella)" aria-label="Ville ou région" />
          <select className={`${input} w-28`} value={radius} onChange={(e) => setRadius(Number(e.target.value) as RadiusKm)} aria-label="Rayon">
            {RADII_KM.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary">
            <Search className="size-4" aria-hidden /> Chercher
          </Button>
        </form>
        {places.length > 0 && (
          <ul className="space-y-1">
            {places.map((p, i) => (
              <li key={i}>
                <button type="button" onClick={() => listGolfs(p)} className="frost w-full rounded-[14px] px-3 py-2 text-left text-sm hover:bg-white/60">
                  <strong>{p.label}</strong> <span className="text-muted">{p.sublabel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Recherche des golfs…</p>}
      </section>

      {golfs && place && (
        <section className="glass glass-rounded space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              2. {golfs.length} golf(s) avec site web autour de {place.label}
            </h2>
            <Button variant="primary" onClick={run} disabled={running || targets.length === 0}>
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe className="size-4" aria-hidden />}
              {running ? `Collecte… ${done}/${targets.length}` : `Lancer la collecte (${targets.length})`}
            </Button>
          </div>
          {running && (
            <div className="h-1.5 overflow-hidden rounded-full bg-card-2" role="progressbar" aria-valuemin={0} aria-valuemax={targets.length} aria-valuenow={done}>
              <div className="h-full bg-fairway-500 transition-[width]" style={{ width: `${(done / Math.max(1, targets.length)) * 100}%` }} />
            </div>
          )}
          <ul className="divide-y divide-[var(--line)] text-sm">
            {golfs.map((g) => {
              const st = state[g.id];
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium">{g.name}</span>
                    <a href={g.website!} target="_blank" rel="noopener noreferrer" className="text-xs text-link underline">
                      {new URL(g.website!).hostname}
                    </a>
                  </span>
                  <span className="flex items-center gap-2">
                    {g.prices.length > 0 && <span className="text-xs text-muted">déjà {g.prices.length} tarif(s)</span>}
                    {st?.status === 'running' && <Loader2 className="size-4 animate-spin text-muted" aria-label="en cours" />}
                    {st?.status === 'done' && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <CheckCircle2 className="size-4 text-fairway-600" aria-hidden />
                        {st.found ? `${st.suggested} tarif(s) proposé(s) / ${st.found} montant(s)` : 'aucun tarif publié'}
                      </span>
                    )}
                    {st?.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
                        <CircleAlert className="size-4" aria-hidden /> {st.note}
                      </span>
                    )}
                    <Link to={`/admin/golf/${encodeURIComponent(g.id)}`} className="rounded-full px-3 py-2 text-xs font-semibold text-link hover:underline">
                      Vérifier →
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="glass glass-rounded space-y-3 p-5">
        <h2 className="text-xl font-semibold">3. Propositions à vérifier ({pending.data?.length ?? 0})</h2>
        {pending.data?.length === 0 && <p className="text-sm text-muted">Aucune proposition en attente.</p>}
        <ul className="divide-y divide-[var(--line)] text-sm">
          {pending.data?.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span>
                <span className="font-medium">{e.golfName ?? e.golfId}</span>
                <span className="block text-xs text-muted">
                  {e.suggestedCount} tarif(s) proposé(s) · {new Date(e.createdAt).toLocaleString('fr-FR')}
                </span>
              </span>
              <Link to={`/admin/golf/${encodeURIComponent(e.golfId)}`} className="rounded-full px-3 py-2 text-xs font-semibold text-link hover:underline">
                Vérifier et publier →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
