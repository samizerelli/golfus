import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

/** Bandeau discret quand l'appareil n'a plus de connexion (site et app iOS). Disparaît dès le retour du réseau. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[3000] mx-auto flex max-w-md items-center gap-3 rounded-[20px] px-4 py-3 text-sm shadow-lg"
    >
      <WifiOff className="size-5 shrink-0 text-muted" aria-hidden />
      <span>
        <strong className="block font-semibold">{t('offline.title')}</strong>
        <span className="text-muted">{t('offline.body')}</span>
      </span>
    </div>
  );
}
