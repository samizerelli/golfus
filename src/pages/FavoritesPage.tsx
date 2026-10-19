import { ChevronRight, Heart, HeartOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GolfPhoto } from '../components/GolfBits';
import { Badge } from '../components/ui';
import { useI18n } from '../i18n';
import { useFavorites } from '../lib/favorites';
import { haversineKm } from '../lib/geo';
import { useSearch } from '../state/search';

export function FavoritesPage() {
  const { t } = useI18n();
  const { favorites, toggle } = useFavorites();
  const { origin } = useSearch();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32">
        <h1 className="text-[28px] leading-tight">{t('fav.title')}</h1>
        <p className="text-sm text-muted">{t('fav.local')}</p>
        {favorites.length === 0 && (
          <div className="glass glass-rounded animate-rise flex flex-col items-center px-6 py-10 text-center">
            <span className="frost mb-4 grid size-16 place-items-center rounded-full">
              <Heart className="size-7 text-gold-700 dark:text-gold-300" aria-hidden />
            </span>
            <p className="max-w-xs text-muted">{t('fav.empty')}</p>
          </div>
        )}
        <ul className="space-y-3">
          {favorites.map((f) => (
            <li key={f.id} className="glass glass-rounded animate-rise flex items-center gap-3 p-2.5 pr-3">
              <GolfPhoto src={f.photo} alt="" className="size-16 shrink-0 rounded-[20px]" />
              <Link to={`/golf/${encodeURIComponent(f.id)}`} className="group min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold tracking-tight group-hover:underline">{f.name || t('card.unnamed')}</span>
                <span className="flex flex-wrap gap-1.5 text-sm text-muted">
                  {f.isDemo && <Badge tone="demo">{t('demo.badge')}</Badge>}
                  {f.holes && <Badge>{t('card.holes', { n: f.holes })}</Badge>}
                  {origin && <span>{t('card.km', { d: Math.round(haversineKm(origin.lat, origin.lon, f.lat, f.lon) * 10) / 10 })}</span>}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => toggle(f)}
                className="grid size-11 place-items-center rounded-full hover:bg-card-2"
                aria-label={`${t('action.unfavorite')} : ${f.name}`}
              >
                <HeartOff className="size-5 text-red-700 dark:text-red-300" aria-hidden />
              </button>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
