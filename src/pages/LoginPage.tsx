import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GlassButton, GlassCard } from '../components/glass';
import { Logo } from '../components/Logo';
import { Button, Notice, Segmented } from '../components/ui';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/fr';
import { api, ApiError, auth } from '../lib/api';
import { useAuth } from '../lib/auth';

type Mode = 'login' | 'register' | 'forgot';
const input = 'frost mt-1.5 h-12 w-full rounded-[16px] px-4 text-base text-ink placeholder:text-muted';

const ERRORS: Record<string, DictKey> = {
  CredentialsSignin: 'auth.err.credentials',
  email_taken: 'auth.err.emailTaken',
  password_too_short: 'auth.err.passwordShort',
  password_too_weak: 'auth.err.passwordWeak',
  rate_limited: 'auth.err.rateLimited',
  Verification: 'auth.err.linkExpired',
};

export function LoginPage() {
  const { t, lang } = useI18n();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const providers = useQuery({ queryKey: ['auth-providers'], queryFn: api.authProviders, staleTime: Infinity });
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [sent, setSent] = useState(params.get('envoye') === '1');

  useEffect(() => {
    if (user) navigate('/profil', { replace: true });
  }, [user, navigate]);

  const errText = (code: string) => t(ERRORS[code] ?? 'auth.err.generic');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'forgot') {
        const r = await auth.sendMagicLink(email, `${location.origin}/profil?motdepasse=1`);
        if (!r.ok) setError(r.error ?? 'generic');
        else setSent(true);
        return;
      }
      if (mode === 'register') await api.register({ email, password, name, lang, terms: true });
      const r = await auth.signInPassword(email, password);
      if (!r.ok) return setError(r.error ?? 'generic');
      await refresh();
      navigate('/profil', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'generic');
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    if (!email) return setError('emailRequired');
    setBusy(true);
    const r = await auth.sendMagicLink(email, `${location.origin}/profil`);
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'generic');
    else setSent(true);
  };

  const p = providers.data;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32">
        <Link to="/profil" className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> {t('nav.profile')}
        </Link>
        <header className="flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-[28px] leading-tight">{mode === 'register' ? t('auth.tabRegister') : mode === 'forgot' ? t('auth.forgot') : t('auth.title')}</h1>
            <p className="text-sm text-muted">{t('auth.subtitle')}</p>
          </div>
        </header>

        <GlassCard className="space-y-4 p-5">
          {mode !== 'forgot' && (
            <Segmented<Mode>
              label={t('auth.title')}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'login', label: t('auth.tabLogin') },
                { value: 'register', label: t('auth.tabRegister') },
              ]}
            />
          )}

          {sent ? (
            <Notice>
              <p className="flex items-start gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('auth.magicSent')}
              </p>
            </Notice>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {mode === 'register' && (
                <label className="block text-sm font-medium">
                  {t('auth.name')}
                  <input className={input} required maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <label className="block text-sm font-medium">
                {t('auth.email')}
                <input className={input} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {mode !== 'forgot' && (
                <label className="block text-sm font-medium">
                  {t('auth.password')}
                  <input
                    className={input}
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === 'register' && <span className="mt-1 block text-xs font-normal text-muted">{t('auth.passwordHint')}</span>}
                </label>
              )}
              {mode === 'register' && (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-fairway-700" />
                  <span>
                    {t('auth.terms')}{' '}
                    <Link to="/confidentialite" className="text-link underline underline-offset-2">
                      {t('nav.privacy')}
                    </Link>
                  </span>
                </label>
              )}
              {mode === 'forgot' && <p className="text-sm text-muted">{p?.email ? t('auth.forgotHelp') : t('auth.forgotNoEmail')}</p>}
              {error && <Notice tone="error">{error === 'emailRequired' ? t('auth.err.emailRequired') : errText(error)}</Notice>}
              {(mode !== 'forgot' || p?.email) && (
                <Button type="submit" variant="primary" disabled={busy} className="w-full">
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {mode === 'login' ? t('auth.submitLogin') : mode === 'register' ? t('auth.submitRegister') : t('auth.magic')}
                </Button>
              )}
            </form>
          )}

          {mode === 'login' && !sent && (
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button type="button" className="h-11 font-medium text-link underline-offset-2 hover:underline" onClick={() => setMode('forgot')}>
                {t('auth.forgot')}
              </button>
            </div>
          )}
          {mode === 'forgot' && (
            <button type="button" className="h-11 text-sm font-medium text-link hover:underline" onClick={() => setMode('login')}>
              ← {t('auth.tabLogin')}
            </button>
          )}

          {mode !== 'forgot' && !sent && (p?.email || p?.google || p?.apple) && (
            <div className="space-y-2">
              <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-[var(--line)] after:h-px after:flex-1 after:bg-[var(--line)]">{t('auth.or')}</p>
              {p.email && (
                <GlassButton className="w-full" onClick={magic} disabled={busy}>
                  <Mail className="size-4" aria-hidden /> {t('auth.magic')}
                </GlassButton>
              )}
              {p.google && (
                <GlassButton className="w-full" onClick={() => auth.oauth('google')}>
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
                    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
                  </svg>
                  {t('auth.google')}
                </GlassButton>
              )}
              {p.apple && (
                <GlassButton className="w-full" onClick={() => auth.oauth('apple')}>
                   {t('auth.apple')}
                </GlassButton>
              )}
            </div>
          )}
        </GlassCard>
        <p className="px-1 text-xs text-muted">{t('auth.guestNote')}</p>
      </div>
    </div>
  );
}
