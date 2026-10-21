import { ChevronRight, Lock, ShieldCheck, Wrench } from 'lucide-react';
import { AccountPanel } from '../components/AccountPanel';
import { BackLink } from '../components/BackLink';
import { isNative } from '../lib/platform';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCIES, type Currency } from '../../shared/types';
import { Logo } from '../components/Logo';
import { Segmented } from '../components/ui';
import { LANGS, useI18n } from '../i18n';
import { useSettings, type Theme } from '../lib/settings';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[15px] font-medium">{label}</span>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">{children}</div>
    </div>
  );
}

export function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme, currency, setCurrency } = useSettings();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl space-y-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32">
        <BackLink home />
        <header className="flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-[28px] leading-tight">{t('nav.profile')}</h1>
            <p className="text-sm text-muted">{t('app.tagline')}</p>
          </div>
        </header>

        <AccountPanel />

        <section aria-labelledby="prefs" className="glass glass-rounded divide-y divide-[var(--line)] px-5 py-2">
          <h2 id="prefs" className="sr-only">
            {t('nav.settings')}
          </h2>
          <Row label={t('settings.language')}>
            <Segmented
              label={t('settings.language')}
              value={lang}
              onChange={setLang}
              options={LANGS.map((l) => ({ value: l, label: { fr: 'Français', en: 'English', es: 'Español' }[l] }))}
              size="sm"
            />
          </Row>
          <Row label={t('settings.currency')}>
            <Segmented<Currency> label={t('settings.currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} size="sm" />
          </Row>
          <Row label={t('settings.theme')}>
            <Segmented<Theme>
              label={t('settings.theme')}
              value={theme}
              onChange={setTheme}
              options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`theme.${v}`) }))}
              size="sm"
            />
          </Row>
        </section>

        <section className="glass glass-rounded overflow-hidden">
          {[
            { to: '/confidentialite', label: t('nav.privacy'), Icon: ShieldCheck },
            { to: '/mentions-legales', label: t('nav.legal'), Icon: Lock },
            // Administration : sur le site seulement, pas dans l'app
            ...(isNative() ? [] : [{ to: '/admin', label: t('account.admin'), Icon: Wrench }]),
          ].map(({ to, label, Icon }) => (
            <Link key={to} to={to} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-white/30 dark:hover:bg-white/5">
              <Icon className="size-5 text-muted" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          ))}
        </section>

        <p className="flex items-start gap-2 px-1 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('welcome.privacy')} {t('fav.local')}
        </p>
        <p className="px-1 text-xs text-muted">{t('footer.osm')}</p>
      </div>
    </div>
  );
}
