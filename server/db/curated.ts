/**
 * Fiches relevées à la main sur les sites officiels des golfs (tarifs publics, horaires, coordonnées).
 *
 * - Chaque montant provient d'une page publique du golf (pricingUrl) consultée à la date priceUpdatedAt ;
 *   aucune réservation n'a été effectuée. Les tarifs restent « indicatifs » : ils changent selon la saison.
 * - Ce qui n'est pas publié reste vide (affiché « Non communiqué ») : rien n'est estimé.
 * - Import automatique au démarrage (local et en ligne) quand CURATED_VERSION change. Une fiche modifiée
 *   ensuite dans /admin est conservée jusqu'à la prochaine version de ce fichier.
 */
import type { GolfEditable, PriceRow } from '../../shared/types.ts';
import { db } from './index.ts';
import { CURATED_GOLFS } from './curatedData.ts';

export type CuratedGolf = Partial<Omit<GolfEditable, 'prices'>> & {
  id: string;
  name: string;
  lat: number;
  lon: number;
  prices?: (Omit<PriceRow, 'currency' | 'season' | 'dayType'> & Partial<Pick<PriceRow, 'currency' | 'season' | 'dayType'>>)[];
};

const KEY = 'curated:version';

function version() {
  // Empreinte du contenu : toute modification des données déclenche un nouvel import
  const s = JSON.stringify(CURATED_GOLFS);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `v${(h >>> 0).toString(36)}`;
}

let done: Promise<void> | null = null;

/** À appeler au démarrage, une fois la base prête. Sans effet si la version est déjà importée. */
export function importCurated() {
  done ??= (async () => {
    const v = version();
    const cur = await db.get<{ value: string }>('SELECT value FROM api_cache WHERE key = ?', KEY);
    if (cur?.value === v) return;
    const { saveGolf, getStoredEditable } = await import('../services/golfs.ts');
    for (const c of CURATED_GOLFS) {
      const prev = await getStoredEditable(c.id);
      await saveGolf({
        // Base : fiche existante (photos, description… saisies dans /admin) ou fiche vide
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
        ...prev,
        ...c,
        prices: (c.prices ?? []).map((p) => ({ currency: 'EUR', season: 'all', dayType: 'all', ...p })),
      } as GolfEditable);
    }
    await db.run(
      'INSERT INTO api_cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
      KEY,
      v,
      Number.MAX_SAFE_INTEGER,
    );
    console.log(`⛳ ${CURATED_GOLFS.length} fiches de golf vérifiées importées (${v})`);
  })().catch((e) => {
    done = null;
    console.error('[curated]', (e as Error).message);
  });
  return done;
}
