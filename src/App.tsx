import { lazy, Suspense, useState, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { GlassFx } from './components/glass';
import { RailProvider } from './components/ActionRail';
import { Intro, introSeen } from './components/Intro';
import { useAuth } from './lib/auth';
import { useI18n } from './i18n';
import { PageSkeleton } from './components/PageSkeleton';

// Pages secondaires chargées à la demande : l'accueil (carte + recherche) s'affiche plus vite
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const MapLayout = named(() => import('./pages/MapLayout'), 'MapLayout');
const HomeScreen = named(() => import('./pages/MapLayout'), 'HomeScreen');
const InviteRoute = named(() => import('./pages/MapLayout'), 'InviteRoute');
const GolfPage = named(() => import('./pages/GolfPage'), 'GolfPage');
const InvitationPage = named(() => import('./pages/InvitationPage'), 'InvitationPage');
const FavoritesPage = named(() => import('./pages/FavoritesPage'), 'FavoritesPage');
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage');
const LoginPage = named(() => import('./pages/LoginPage'), 'LoginPage');
const LegalPage = named(() => import('./pages/LegalPages'), 'LegalPage');
const PrivacyPage = named(() => import('./pages/LegalPages'), 'PrivacyPage');
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  // Intro « I wanna play » : visiteur non connecté, à l'arrivée sur l'accueil, une fois par session
  const [introOpen, setIntroOpen] = useState(() => !introSeen());
  const showIntro = introOpen && !loading && !user && pathname === '/';
  return (
    <RailProvider>
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
        <Suspense fallback={<PageSkeleton label={t('common.loading')} />}>
          <Routes>
            {/* Les 3 écrans partagent la carte en fond */}
            <Route element={<MapLayout />}>
              <Route index element={<HomeScreen />} />
              <Route path="/inviter/:id" element={<InviteRoute />} />
            </Route>
            <Route path="/invitation/:token" element={<InvitationPage />} />
            <Route path="/golf/:id" element={<GolfPage />} />
            <Route path="/favoris" element={<FavoritesPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/mentions-legales" element={<LegalPage />} />
            <Route path="/confidentialite" element={<PrivacyPage />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
    </RailProvider>
  );
}
