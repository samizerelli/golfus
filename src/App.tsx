import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { GlassFx } from './components/glass';
import { RailProvider, useRail } from './components/ActionRail';
import { hadAccount, Intro, introSeen, markSeen } from './components/Intro';
import { useAuth } from './lib/auth';
import { useI18n } from './i18n';
import { PageSkeleton } from './components/PageSkeleton';
import { isNative, onOpenInApp } from './lib/platform';
import { refreshPush } from './lib/push';

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

/** App iOS : ouvre l'écran demandé par iOS (notification, lien golfus.ch) et tient à jour le jeton push. */
function NativeBridge() {
  const navigate = useNavigate();
  const { setOpen } = useRail();
  const { user } = useAuth();
  const { lang } = useI18n();
  useEffect(
    () =>
      onOpenInApp(({ path, panel }) => {
        if (path) navigate(path);
        if (panel) setOpen(panel);
      }),
    [navigate, setOpen],
  );
  useEffect(() => {
    if (user) void refreshPush(lang);
  }, [user?.id, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function App() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  // Intro « I wanna play » : visiteur non connecté, à l'arrivée sur l'accueil, une fois par session
  const [introOpen, setIntroOpen] = useState(() => !introSeen());
  // Affichée d'emblée (sans attendre la session), sauf si l'appareil a déjà servi à se connecter :
  // on attend alors la réponse pour ne pas la montrer à quelqu'un de connecté
  const showIntro = introOpen && !user && pathname === '/' && !(loading && hadAccount());
  // Le visiteur part sur une autre page : l'intro ne doit plus surgir par-dessus en revenant.
  // (Elle ne dépend plus de la position, détectée automatiquement pendant qu'elle est affichée.)
  useEffect(() => {
    if (introOpen && pathname !== '/') {
      markSeen();
      setIntroOpen(false);
    }
  }, [pathname, introOpen]);
  return (
    <RailProvider>
    {isNative() && <NativeBridge />}
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
