import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary, watchStaleAssets } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import { AuthProvider } from './lib/auth';
import { FavoritesProvider } from './lib/favorites';
import { SettingsProvider } from './lib/settings';
import { SearchProvider } from './state/search';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 10 * 60_000, retry: 1 },
  },
});

watchStaleAssets();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <SettingsProvider>
            <AuthProvider>
            <FavoritesProvider>
              <SearchProvider>
                <App />
              </SearchProvider>
            </FavoritesProvider>
            </AuthProvider>
          </SettingsProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
