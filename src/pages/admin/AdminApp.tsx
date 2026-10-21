// Espace d'administration (en français uniquement : il est destiné à l'exploitant du site).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Globe, KeyRound, LogOut, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  CURRENCIES,
  PRICE_CATEGORIES,
  SERVICE_KEYS,
  type Course,
  type GolfEditable,
  type PriceRow,
  type ServiceKey,
} from '../../../shared/types';
import { Button, buttonClass, Notice } from '../../components/ui';
import { api, type AdminReport, ApiError } from '../../lib/api';
import { formatIntervals, intervalsOn, parseHours, useHoursLib, weekStart } from '../../lib/hours';
import { AdminCollect } from './AdminCollect';
import { ExtractPanel } from './ExtractPanel';

const CAT_LABEL: Record<string, string> = {
  green_fee_18: 'Green fee 18 trous',
  green_fee_9: 'Green fee 9 trous',
  twilight: 'Twilight',
  buggy: 'Voiturette',
  club_rental: 'Location de clubs',
  trolley: 'Chariot',
  range_balls: 'Balles de practice',
  lesson: 'Cours',
};
const SERVICE_LABEL: Record<ServiceKey, string> = {
  clubRental: 'Location de clubs',
  drivingRange: 'Practice',
  restaurant: 'Restaurant',
  buggy: 'Voiturette',
  proShop: 'Pro shop',
  lessons: 'Cours',
};
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const input = 'h-11 w-full rounded-[14px] border border-line bg-white/70 px-3 text-sm text-ink dark:bg-white/5';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs font-normal text-muted">{hint}</p>}
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass glass-rounded space-y-4 p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function useSession() {
  return useQuery({ queryKey: ['admin-session'], queryFn: api.admin.session, retry: false });
}

function Login() {
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api.admin.login(password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-session'] }),
  });
  const err = m.error as ApiError | null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="glass glass-rounded mx-auto mt-10 w-full max-w-sm space-y-4 p-6"
    >
      <h1 className="text-2xl font-semibold">Administration</h1>
      <Field label="Mot de passe">
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </Field>
      {err && (
        <Notice tone="error">
          {err.code === 'too_many_attempts' ? 'Trop de tentatives. Réessayez dans 15 minutes.' : 'Mot de passe incorrect.'}
        </Notice>
      )}
      <Button type="submit" variant="primary" disabled={m.isPending} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}

function parseOsmInput(v: string): string | null {
  const s = v.trim();
  if (/^osm-[nwr]\d+$/.test(s)) return s;
  const m = /openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(s);
  if (m) return `osm-${m[1][0]}${m[2]}`;
  return null;
}

function AdminList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin-list'], queryFn: api.admin.list });
  const [osm, setOsm] = useState('');
  const [osmError, setOsmError] = useState(false);
  const logout = useMutation({ mutationFn: api.admin.logout, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-session'] }) });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Administration</h1>
        <div className="flex flex-wrap gap-2">
        <Link to="/admin/collecte" className={buttonClass('secondary', 'sm')}>
          <Globe className="size-4" aria-hidden /> Collecte sites officiels
        </Link>
        <Link to="/admin/signalements" className={buttonClass('secondary', 'sm')}>
          <Flag className="size-4" aria-hidden /> Signalements
        </Link>
        <Link to="/admin/utilisateurs" className={buttonClass('secondary', 'sm')}>
          <Users className="size-4" aria-hidden /> Utilisateurs
        </Link>
        <Button size="sm" onClick={() => logout.mutate()}>
          <LogOut className="size-4" aria-hidden /> Déconnexion
        </Button>
        </div>
      </div>

      <Card title="Compléter un golf OpenStreetMap">
        <p className="text-sm text-muted">
          Ouvrez la fiche d’un golf dans l’application puis cliquez sur « Compléter cette fiche (admin) », ou collez ici son lien
          OpenStreetMap (ex. https://www.openstreetmap.org/way/97671239) ou son identifiant (osm-w97671239).
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = parseOsmInput(osm);
            setOsmError(!id);
            if (id) navigate(`/admin/golf/${id}`);
          }}
        >
          <input value={osm} onChange={(e) => setOsm(e.target.value)} className={input} aria-label="Lien ou identifiant OpenStreetMap" />
          <Button type="submit" variant="primary">
            Ouvrir
          </Button>
        </form>
        {osmError && <Notice tone="error">Lien ou identifiant non reconnu.</Notice>}
        <Link to="/admin/nouveau" className={buttonClass('secondary', 'sm')}>
          <Plus className="size-4" aria-hidden /> Créer un golf absent d’OpenStreetMap
        </Link>
      </Card>

      <Card title="Golfs complétés dans la base">
        {list.isLoading && <p className="text-muted">Chargement…</p>}
        {list.data && list.data.length === 0 && <p className="text-muted">Aucun golf pour l’instant.</p>}
        {list.data && list.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 font-normal">Golf</th>
                  <th className="py-2 font-normal">Tarifs</th>
                  <th className="py-2 font-normal">Fiabilité</th>
                  <th className="py-2 font-normal">Modifié</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((g) => (
                  <tr key={g.id} className="border-b border-line/60">
                    <td className="py-2">
                      <Link to={`/admin/golf/${encodeURIComponent(g.id)}`} className="font-medium underline underline-offset-2">
                        {g.name || g.id}
                      </Link>
                      {g.isDemo ? <span className="ml-2 text-xs text-violet-700 dark:text-violet-300">démo</span> : null}
                      <span className="block text-xs text-muted">{g.id}</span>
                    </td>
                    <td className="py-2">{g.priceCount}</td>
                    <td className="py-2">{{ verified: 'Vérifié', indicative: 'Indicatif', unknown: '—' }[g.priceReliability] ?? g.priceReliability}</td>
                    <td className="py-2 text-muted">{new Date(g.updatedAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const EMPTY: GolfEditable = {
  id: '',
  name: null,
  lat: null,
  lon: null,
  isDemo: false,
  holes: null,
  par: null,
  phone: null,
  email: null,
  website: null,
  bookingUrl: null,
  pricingUrl: null,
  address: null,
  openingHours: null,
  description: {},
  photos: [],
  courses: [],
  services: {},
  priceReliability: 'indicative',
  priceUpdatedAt: null,
  highSeasonMonths: [],
  offers: [],
  prices: [],
};

function HoursPreview({ value, lat, lon }: { value: string; lat: number; lon: number }) {
  const ready = useHoursLib();
  const oh = parseHours(value, lat, lon);
  if (!value || !ready) return null;
  if (!oh) return <Notice tone="error">Format d’horaires invalide.</Notice>;
  const monday = weekStart(new Date());
  return (
    <ul className="grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        const list = intervalsOn(oh, d) ?? [];
        return (
          <li key={i} className="flex justify-between border-b border-line/60 py-1">
            <span className="capitalize">{d.toLocaleDateString('fr-FR', { weekday: 'long' })}</span>
            <span className="tabular-nums">{list.length ? formatIntervals(list, 'fr-FR') : 'Fermé'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function AdminEdit({ create = false }: { create?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-golf', id], queryFn: () => api.admin.get(id), enabled: !create });
  const [g, setG] = useState<GolfEditable>({ ...EMPTY });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setG(q.data.golf);
  }, [q.data]);

  const osm = (q.data?.osm ?? null) as Record<string, string | number | null> | null;
  const ph = (k: string) => (osm?.[k] != null ? `OSM : ${osm[k]}` : undefined);
  const set = <K extends keyof GolfEditable>(k: K, v: GolfEditable[K]) => setG((x) => ({ ...x, [k]: v }));
  const str = (v: string) => (v.trim() === '' ? null : v);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const [appliedExtraction, setAppliedExtraction] = useState<number | null>(null);
  const [applyNote, setApplyNote] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      if (create) return api.admin.create(g);
      await api.admin.save({ ...g, id });
      if (appliedExtraction) await api.admin.setExtractionStatus(appliedExtraction, 'applied');
      return { id };
    },
    onSuccess: (r) => {
      setApplyNote(false);
      setAppliedExtraction(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries();
      if (create) navigate(`/admin/golf/${r.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.admin.remove(id),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate('/admin');
    },
  });
  const delReview = useMutation({
    mutationFn: (rid: number) => api.admin.deleteReview(rid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-golf', id] }),
  });

  const lat = g.lat ?? (osm?.lat as number) ?? 45;
  const lon = g.lon ?? (osm?.lon as number) ?? 5;
  const hoursReady = useHoursLib();
  const hoursValid = useMemo(
    () => !hoursReady || !g.openingHours || parseHours(g.openingHours, lat, lon) !== null,
    [g.openingHours, lat, lon, hoursReady],
  );

  const setPrice = (i: number, patch: Partial<PriceRow>) =>
    set('prices', g.prices.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setCourse = (i: number, patch: Partial<Course>) =>
    set('courses', g.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addGrid = (category: PriceRow['category']) =>
    set('prices', [
      ...g.prices,
      ...(['low', 'high'] as const).flatMap((season) =>
        (['weekday', 'weekend'] as const).map((dayType) => ({ category, season, dayType, amount: 0, currency: 'EUR' as const, note: null })),
      ),
    ]);

  if (!create && q.isLoading) return <p className="p-6 text-muted">Chargement…</p>;
  if (!create && q.error) return <div className="p-6"><Notice tone="error">Golf introuvable ({id}).</Notice></div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (hoursValid) save.mutate();
  };
  const saveError = save.error as ApiError | null;

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-4xl space-y-4 p-4 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-muted underline underline-offset-2">
            ← Administration
          </Link>
          <h1 className="text-3xl font-semibold">{create ? 'Nouveau golf' : g.name || (osm?.name as string) || id}</h1>
          {!create && (
            <p className="text-sm text-muted">
              {id} ·{' '}
              <Link to={`/golf/${encodeURIComponent(id)}`} className="underline">
                voir la fiche publique
              </Link>
            </p>
          )}
        </div>
      </div>

      {osm && (
        <Notice>
          Les champs laissés vides reprennent automatiquement les données OpenStreetMap (affichées en grisé). Ce que vous saisissez ici
          est prioritaire.
        </Notice>
      )}

      {!create && (
        <ExtractPanel
          golfId={id}
          website={g.website ?? (osm?.website as string | undefined) ?? null}
          golf={g}
          onApply={(patch, extractionId) => {
            setG((x) => ({ ...x, ...patch }));
            setAppliedExtraction(extractionId);
            setApplyNote(true);
          }}
        />
      )}
      {applyNote && <Notice tone="warn">Propositions ajoutées au formulaire ci-dessous. Vérifiez-les, puis cliquez sur « Enregistrer » pour les publier.</Notice>}

      <Card title="Identité">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={create ? 'Nom *' : 'Nom'}>
            <input className={input} required={create} value={g.name ?? ''} placeholder={ph('name')} onChange={(e) => set('name', str(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trous">
              <input className={input} type="number" min={1} max={72} value={g.holes ?? ''} placeholder={ph('holes')} onChange={(e) => set('holes', num(e.target.value))} />
            </Field>
            <Field label="Par">
              <input className={input} type="number" min={1} max={300} value={g.par ?? ''} placeholder={ph('par')} onChange={(e) => set('par', num(e.target.value))} />
            </Field>
          </div>
          <Field label={create ? 'Latitude *' : 'Latitude'}>
            <input className={input} type="number" step="any" required={create} value={g.lat ?? ''} placeholder={ph('lat')} onChange={(e) => set('lat', num(e.target.value))} />
          </Field>
          <Field label={create ? 'Longitude *' : 'Longitude'}>
            <input className={input} type="number" step="any" required={create} value={g.lon ?? ''} placeholder={ph('lon')} onChange={(e) => set('lon', num(e.target.value))} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={g.isDemo} onChange={(e) => set('isDemo', e.target.checked)} />
          Données de démonstration (badge « Démo », masquable avec SHOW_DEMO_DATA=false)
        </label>
      </Card>

      <Card title="Tarifs">
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 font-medium">Fiabilité</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="rel" checked={g.priceReliability === 'verified'} onChange={() => set('priceReliability', 'verified')} />
            Vérifié (confirmé auprès du golf)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="rel" checked={g.priceReliability !== 'verified'} onChange={() => set('priceReliability', 'indicative')} />
            Indicatif — « à confirmer auprès du golf »
          </label>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de vérification">
            <input className={input} type="date" value={g.priceUpdatedAt ?? ''} onChange={(e) => set('priceUpdatedAt', str(e.target.value))} />
          </Field>
          <Field label="Page tarifs officielle (URL)">
            <input className={input} type="url" value={g.pricingUrl ?? ''} onChange={(e) => set('pricingUrl', str(e.target.value))} placeholder="https://…" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Mois de haute saison</legend>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map((m, i) => {
              const on = g.highSeasonMonths.includes(i + 1);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set('highSeasonMonths', on ? g.highSeasonMonths.filter((x) => x !== i + 1) : [...g.highSeasonMonths, i + 1].sort((a, b) => a - b))
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? 'border-gold-600 bg-gold-200 text-gold-800' : 'border-line'}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">Catégorie</th>
                <th className="py-1 font-normal">Saison</th>
                <th className="py-1 font-normal">Jours</th>
                <th className="py-1 font-normal">Montant</th>
                <th className="py-1 font-normal">Devise</th>
                <th className="py-1 font-normal">Période (MM-JJ)</th>
                <th className="py-1 font-normal">Départs</th>
                <th className="py-1 font-normal">Remarque</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {g.prices.map((p, i) => (
                <tr key={i}>
                  <td className="py-1 pr-1">
                    <select className={input} value={p.category} onChange={(e) => setPrice(i, { category: e.target.value as PriceRow['category'] })} aria-label="Catégorie">
                      {PRICE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CAT_LABEL[c]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className={input} value={p.season} onChange={(e) => setPrice(i, { season: e.target.value as PriceRow['season'] })} aria-label="Saison">
                      <option value="all">Toute l’année</option>
                      <option value="low">Basse</option>
                      <option value="high">Haute</option>
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className={input} value={p.dayType} onChange={(e) => setPrice(i, { dayType: e.target.value as PriceRow['dayType'] })} aria-label="Jours">
                      <option value="all">Tous</option>
                      <option value="weekday">Semaine</option>
                      <option value="weekend">Week-end</option>
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <input className={`${input} w-24`} type="number" min={0} step="0.01" required value={p.amount} onChange={(e) => setPrice(i, { amount: Number(e.target.value) })} aria-label="Montant" />
                  </td>
                  <td className="py-1 pr-1">
                    <select className={input} value={p.currency} onChange={(e) => setPrice(i, { currency: e.target.value as PriceRow['currency'] })} aria-label="Devise">
                      {CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <span className="flex items-center gap-1">
                      <input className={`${input} w-[4.5rem]`} placeholder="09-28" pattern="\d{2}-\d{2}" value={p.fromDate ?? ''} onChange={(e) => setPrice(i, { fromDate: e.target.value || null })} aria-label="Valable du (MM-JJ)" />
                      –
                      <input className={`${input} w-[4.5rem]`} placeholder="11-15" pattern="\d{2}-\d{2}" value={p.toDate ?? ''} onChange={(e) => setPrice(i, { toDate: e.target.value || null })} aria-label="Valable jusqu'au (MM-JJ)" />
                    </span>
                  </td>
                  <td className="py-1 pr-1">
                    <span className="flex items-center gap-1">
                      <input className={`${input} w-[5.5rem]`} type="time" value={p.fromTime ?? ''} onChange={(e) => setPrice(i, { fromTime: e.target.value || null })} aria-label="Départs à partir de" />
                      –
                      <input className={`${input} w-[5.5rem]`} type="time" value={p.toTime ?? ''} onChange={(e) => setPrice(i, { toTime: e.target.value || null })} aria-label="Départs jusqu'à" />
                    </span>
                  </td>
                  <td className="py-1 pr-1">
                    <input className={input} value={p.note ?? ''} onChange={(e) => setPrice(i, { note: str(e.target.value) })} aria-label="Remarque" />
                  </td>
                  <td>
                    <button type="button" onClick={() => set('prices', g.prices.filter((_, j) => j !== i))} className="rounded-full p-2 hover:bg-card-2" aria-label="Supprimer cette ligne">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => set('prices', [...g.prices, { category: 'green_fee_18', season: 'all', dayType: 'all', amount: 0, currency: 'EUR', note: null }])}>
            <Plus className="size-4" aria-hidden /> Ajouter une ligne
          </Button>
          <Button size="sm" onClick={() => addGrid('green_fee_18')}>
            + Grille 18 trous (basse/haute × semaine/week-end)
          </Button>
          <Button size="sm" onClick={() => addGrid('green_fee_9')}>
            + Grille 9 trous
          </Button>
        </div>
      </Card>

      <Card title="Horaires">
        <Field
          label="Horaires au format OpenStreetMap"
          hint={
            <>
              Exemples : <code>Mo-Su 08:00-19:00</code> · <code>Mo 12:00-18:00; Tu-Su 07:30-20:00</code> ·{' '}
              <code>Apr-Oct Mo-Su 08:00-20:00; Nov-Mar off</code> · <code>Mo-Su 07:00-sunset</code>. Laisser vide si inconnu (affiché « Non communiqué »).{' '}
              <a href="https://openingh.openstreetmap.de/evaluation_tool/" target="_blank" rel="noopener noreferrer" className="underline">
                Outil d’aide
              </a>
            </>
          }
        >
          <input
            className={`${input} font-mono ${hoursValid ? '' : 'border-red-600'}`}
            value={g.openingHours ?? ''}
            placeholder={ph('openingHours')}
            onChange={(e) => set('openingHours', str(e.target.value))}
            aria-invalid={!hoursValid}
          />
        </Field>
        <HoursPreview value={g.openingHours ?? (osm?.openingHours as string) ?? ''} lat={lat} lon={lon} />
      </Card>

      <Card title="Coordonnées">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone">
            <input className={input} type="tel" value={g.phone ?? ''} placeholder={ph('phone')} onChange={(e) => set('phone', str(e.target.value))} />
          </Field>
          <Field label="E-mail">
            <input className={input} type="email" value={g.email ?? ''} placeholder={ph('email')} onChange={(e) => set('email', str(e.target.value))} />
          </Field>
          <Field label="Site web">
            <input className={input} type="url" value={g.website ?? ''} placeholder={ph('website')} onChange={(e) => set('website', str(e.target.value))} />
          </Field>
          <Field label="Lien de réservation">
            <input className={input} type="url" value={g.bookingUrl ?? ''} onChange={(e) => set('bookingUrl', str(e.target.value))} placeholder="https://…" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Adresse">
              <input className={input} value={g.address ?? ''} placeholder={ph('address')} onChange={(e) => set('address', str(e.target.value))} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Présentation et photos">
        {(['fr', 'en', 'es'] as const).map((l) => (
          <Field key={l} label={`Description (${l.toUpperCase()})`}>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              value={g.description[l] ?? ''}
              onChange={(e) => set('description', { ...g.description, [l]: e.target.value || undefined })}
            />
          </Field>
        ))}
        <Field label="Photos (une URL https par ligne, libres de droits ou autorisées)">
          <textarea
            rows={3}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
            value={g.photos.join('\n')}
            onChange={(e) => set('photos', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
          />
        </Field>
      </Card>

      <Card title="Parcours">
        {g.courses.map((c, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
            <div className="col-span-2">
              <Field label="Nom">
                <input className={input} value={c.name} onChange={(e) => setCourse(i, { name: e.target.value })} />
              </Field>
            </div>
            <Field label="Trous">
              <input className={input} type="number" value={c.holes ?? ''} onChange={(e) => setCourse(i, { holes: num(e.target.value) })} />
            </Field>
            <Field label="Par">
              <input className={input} type="number" value={c.par ?? ''} onChange={(e) => setCourse(i, { par: num(e.target.value) })} />
            </Field>
            <Field label="Longueur (m)">
              <input className={input} type="number" value={c.lengthM ?? ''} onChange={(e) => setCourse(i, { lengthM: num(e.target.value) })} />
            </Field>
            <div className="flex items-end gap-1">
              <Field label="Difficulté">
                <select className={input} value={c.difficulty ?? ''} onChange={(e) => setCourse(i, { difficulty: (e.target.value || null) as Course['difficulty'] })}>
                  <option value="">—</option>
                  <option value="easy">Facile</option>
                  <option value="medium">Moyenne</option>
                  <option value="hard">Difficile</option>
                </select>
              </Field>
              <button type="button" onClick={() => set('courses', g.courses.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2 hover:bg-card-2" aria-label="Supprimer ce parcours">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        <Button size="sm" onClick={() => set('courses', [...g.courses, { name: '', holes: 18, par: null, lengthM: null, difficulty: null }])}>
          <Plus className="size-4" aria-hidden /> Ajouter un parcours
        </Button>
      </Card>

      <Card title="Services">
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_KEYS.map((k) => (
            <Field key={k} label={SERVICE_LABEL[k]}>
              <select
                className={input}
                value={g.services[k] === true ? 'yes' : g.services[k] === false ? 'no' : ''}
                onChange={(e) => set('services', { ...g.services, [k]: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}
              >
                <option value="">Non communiqué</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </Field>
          ))}
        </div>
      </Card>

      {!create && q.data && q.data.reviews.length > 0 && (
        <Card title="Avis (modération)">
          <ul className="space-y-2">
            {q.data.reviews.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-2xl bg-card-2 p-3 text-sm">
                <span>
                  <strong>{r.author}</strong> — {r.rating}/5
                  <span className="block text-muted">{r.comment}</span>
                </span>
                <Button size="sm" onClick={() => confirm('Supprimer cet avis ?') && delReview.mutate(r.id)}>
                  <Trash2 className="size-4" aria-hidden /> Supprimer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="glass fixed inset-x-0 bottom-0 z-[1200] rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 p-3">
          <div aria-live="polite" className="text-sm">
            {saved && <span className="text-fairway-700 dark:text-fairway-300">✓ Enregistré</span>}
            {saveError && (
              <span className="text-red-700 dark:text-red-300">
                Erreur :{' '}
                {saveError.code === 'invalid_opening_hours'
                  ? 'horaires invalides'
                  : saveError.code === 'manual_requires_name_and_coords'
                    ? 'nom, latitude et longitude obligatoires'
                    : saveError.code}
              </span>
            )}
            {!hoursValid && <span className="text-red-700 dark:text-red-300">Corrigez le format des horaires.</span>}
          </div>
          <div className="flex gap-2">
            {!create && q.data?.golf && (
              <Button
                variant="ghost"
                onClick={() =>
                  confirm('Supprimer les données locales de ce golf ? (les données OpenStreetMap resteront affichées)') && remove.mutate()
                }
              >
                <Trash2 className="size-4" aria-hidden /> Supprimer
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={save.isPending || !hoursValid}>
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const users = useQuery({ queryKey: ['admin-users', q], queryFn: () => api.admin.users(q) });
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  const reset = useMutation({
    mutationFn: (u: { id: string; email: string }) => api.admin.resetPassword(u.id).then((r) => ({ email: u.email, pw: r.temporaryPassword })),
    onSuccess: setTemp,
  });
  const role = useMutation({
    mutationFn: (u: { id: string; role: 'user' | 'admin' }) => api.admin.setRole(u.id, u.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const del = useMutation({ mutationFn: (id: string) => api.admin.deleteUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Link to="/admin" className="text-sm text-muted underline underline-offset-2">
        ← Administration
      </Link>
      <h1 className="text-3xl font-semibold">Utilisateurs</h1>
      <input className={input} placeholder="Rechercher par e-mail ou prénom…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un utilisateur" />
      {temp && (
        <Notice tone="warn">
          Mot de passe provisoire pour <strong>{temp.email}</strong> : <code className="rounded bg-white/70 px-1.5 py-0.5 select-all">{temp.pw}</code>
          <br />
          Transmettez-le à la personne (il n'est affiché qu'une fois) ; elle pourra le changer dans son espace.
        </Notice>
      )}
      <Card title={`${users.data?.length ?? 0} compte(s)`}>
        {users.isLoading && <p className="text-muted">Chargement…</p>}
        <ul className="divide-y divide-[var(--line)]">
          {users.data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.name || '—'} {u.role === 'admin' && <span className="ml-1 rounded-full bg-gold-200 px-2 py-0.5 text-xs text-gold-800">admin</span>}
                </p>
                <p className="truncate text-sm text-muted">{u.email}</p>
                <p className="text-xs text-muted">
                  Inscrit le {date(u.createdAt)} · dernière connexion : {date(u.lastLoginAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => confirm(`Générer un mot de passe provisoire pour ${u.email} ?`) && reset.mutate(u)}>
                  <KeyRound className="size-4" aria-hidden /> Mot de passe
                </Button>
                <Button size="sm" onClick={() => role.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}>
                  <ShieldCheck className="size-4" aria-hidden /> {u.role === 'admin' ? 'Retirer admin' : 'Rendre admin'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`Supprimer définitivement le compte ${u.email} ?`) && del.mutate(u.id)}>
                  <Trash2 className="size-4" aria-hidden /> Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {users.data?.length === 0 && <p className="text-muted">Aucun compte.</p>}
      </Card>
    </div>
  );
}

/**
 * Signalements des utilisateurs (règle App Store 1.2) : à traiter sous 24 heures.
 * Retirer = supprime le contenu (avis, invitation) ou le compte ; Infondé = clôture (un avis masqué redevient visible).
 */
function AdminReports() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: api.admin.reports });
  const done = () => qc.invalidateQueries({ queryKey: ['admin-reports'] });
  const act = useMutation({
    mutationFn: async ({ r, action }: { r: AdminReport; action: 'remove' | 'dismiss' }) => {
      if (action === 'remove') {
        if (r.kind === 'review') await api.admin.deleteReview(Number(r.target_id));
        else if (r.kind === 'user') await api.admin.deleteUser(r.target_id);
        else await api.admin.deleteOuting(r.target_id);
      }
      await api.admin.closeReport(r.kind, r.target_id, action === 'remove' ? 'resolved' : 'dismissed');
    },
    onSuccess: done,
  });
  const kind = { review: 'Avis', user: 'Joueur', outing: 'Invitation' } as const;
  const show = (r: AdminReport) => {
    const x = r.target;
    if (!x) return <em className="text-muted">Contenu déjà supprimé</em>;
    if (r.kind === 'review') return <>« {String(x.comment || '—')} » — {String(x.author)} ({String(x.rating)}★){x.hiddenAt ? ' · masqué' : ''}</>;
    if (r.kind === 'user') return <>{String(x.name ?? '—')} · {String(x.email ?? '')}</>;
    return <>{String(x.golfName)} le {String(x.date)} par {String(x.organizer)} · « {String(x.message ?? '')} »</>;
  };
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Link to="/admin" className="text-sm text-muted underline underline-offset-2">
        ← Administration
      </Link>
      <h1 className="text-3xl font-semibold">Signalements</h1>
      <p className="text-sm text-muted">À traiter sous 24 heures. « Retirer » supprime le contenu (ou le compte du joueur) ; « Infondé » clôt le signalement.</p>
      <Card title={`${reports.data?.length ?? 0} en attente`}>
        {reports.isLoading && <p className="text-muted">Chargement…</p>}
        {reports.data?.length === 0 && <p className="text-muted">Aucun signalement en attente.</p>}
        <ul className="divide-y divide-[var(--line)]">
          {reports.data?.map((r) => (
            <li key={`${r.kind}-${r.target_id}`} className="space-y-2 py-3">
              <p className="text-sm">
                <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{kind[r.kind]}</span>
                {show(r)}
              </p>
              <p className="text-xs text-muted">
                {r.reporters} signalement(s) · motif : {r.reason} {r.details ? `· ${r.details}` : ''} · depuis le {new Date(r.created_at).toLocaleString('fr-FR')}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => confirm('Retirer ce contenu définitivement ?') && act.mutate({ r, action: 'remove' })}>
                  <Trash2 className="size-4" aria-hidden /> Retirer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ r, action: 'dismiss' })}>
                  Infondé
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function AdminApp() {
  const session = useSession();
  let body: ReactNode;
  if (session.isLoading) body = <p className="p-6 text-muted">Chargement…</p>;
  else if (session.data && !session.data.configured)
    body = (
      <div className="mx-auto mt-10 max-w-lg p-4">
        <Notice tone="warn">
          L’administration est désactivée : définissez <code>ADMIN_PASSWORD</code> et <code>ADMIN_SESSION_SECRET</code> (16 caractères
          minimum) dans le fichier <code>.env</code>, puis redémarrez le serveur.
        </Notice>
      </div>
    );
  else if (!session.data?.admin) body = <Login />;
  else
    body = (
      <Routes>
        <Route index element={<AdminList />} />
        <Route path="nouveau" element={<AdminEdit create />} />
        <Route path="golf/:id" element={<AdminEdit />} />
        <Route path="utilisateurs" element={<AdminUsers />} />
        <Route path="signalements" element={<AdminReports />} />
        <Route path="collecte" element={<AdminCollect />} />
      </Routes>
    );
  return <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>;
}
