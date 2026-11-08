import { BackLink } from '../components/BackLink';
import { Logo } from '../components/Logo';
import { AccountBody } from '../components/RailPanels';
import { useI18n } from '../i18n';

/** Page /profil (retour de connexion, liens directs) : même contenu que le panneau « Profil et réglages ». */
export function ProfilePage() {
  const { t } = useI18n();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32">
        <BackLink home />
        <header className="flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-[28px] leading-tight">{t('nav.profile')}</h1>
            <p className="text-sm text-muted">{t('app.tagline')}</p>
          </div>
        </header>
        <AccountBody onNavigate={() => undefined} />
        <p className="px-1 text-xs text-muted">{t('footer.osm')}</p>
      </div>
    </div>
  );
}
