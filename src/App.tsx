import { lazy, Suspense, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { GlassFx } from './components/glass';
import { GlassNav } from './components/GlassNav';
import { Intro, introSeen } from './components/Intro';
import { useAuth } from './lib/auth';
import { useI18n } from './i18n';
import { FavoritesPage } from './pages/FavoritesPage';
import { GolfPage } from './pages/GolfPage';
import { HomePage } from './pages/HomePage';
import { LegalPage, PrivacyPage } from './pages/LegalPages';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const NAV_PATHS = ['/', '/favoris', '/profil'];

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const showNav = NAV_PATHS.includes(pathname);
  const { user, loading } = useAuth();
  // Intro « I wanna play » : visiteur non connecté, à l'arrivée sur l'accueil, une fois par session
  const [introOpen, setIntroOpen] = useState(() => !introSeen());
  const showIntro = introOpen && !loading && !user && pathname === '/';
  return (
    <div className="flex h-dvh flex-col">
      <GlassFx />
      {showIntro && <Intro onClose={() => setIntroOpen(false)} />}
      <a
        href="#main"
        className="sr-only z-[2000] rounded-full bg-fairway-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('nav.skip')}
      </a>
      <main id="main" className="relative flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<p className="p-6 text-muted">{t('common.loading')}</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/golf/:id" element={<GolfPage />} />
            <Route path="/favoris" element={<FavoritesPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/mentions-legales" element={<LegalPage />} />
            <Route path="/confidentialite" element={<PrivacyPage />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Suspense>
      </main>
      {showNav && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1300] flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:justify-end lg:pr-6 lg:pb-6">
          <GlassNav />
        </div>
      )}
    </div>
  );
}
