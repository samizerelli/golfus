import { Camera, Download, KeyRound, Loader2, LogOut, MonitorSmartphone, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api, ApiError } from '../lib/api';
import { compressAvatar, useAuth } from '../lib/auth';
import { GlassCard } from './glass';
import { Button, buttonClass, Dialog, Notice } from './ui';

const input = 'frost mt-1.5 h-12 w-full rounded-[16px] px-4 text-base text-ink';

export function Avatar({ src, name, size = 56 }: { src: string | null; name: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-glacier-200 font-semibold text-glacier-700 dark:bg-white/10 dark:text-glacier-300" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden>
      {name?.trim()[0]?.toUpperCase() ?? <UserRound className="size-1/2" />}
    </span>
  );
}

/** Carte invitée : incitation à se connecter (la recherche reste possible sans compte). */
function GuestCard() {
  const { t } = useI18n();
  return (
    <GlassCard className="space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Avatar src={null} name={null} />
        <div>
          <h2 className="text-lg">{t('auth.guestTitle')}</h2>
          <p className="text-sm text-muted">{t('auth.guestBody')}</p>
        </div>
      </div>
      <Link to="/connexion" className={buttonClass('primary') + ' w-full'}>
        {t('auth.cta')}
      </Link>
    </GlassCard>
  );
}

export function AccountPanel() {
  const { t, locale } = useI18n();
  const { user, loading, refresh, signOut } = useAuth();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(params.get('motdepasse') === '1');
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setHcp(user.handicapIndex?.toString() ?? '');
    }
  }, [user]);

  if (loading) return <div className="skeleton h-40 w-full rounded-[28px]" aria-hidden />;
  if (!user) return <GuestCard />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const h = hcp.trim() === '' ? null : Number(hcp.replace(',', '.'));
    if (h !== null && (!Number.isFinite(h) || h < -10 || h > 54)) return setMsg({ tone: 'error', text: t('account.hcpInvalid') });
    await api.updateMe({ name: name.trim(), handicapIndex: h });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      await api.setAvatar(await compressAvatar(f));
      await refresh();
    } catch {
      setMsg({ tone: 'error', text: t('account.photoError') });
    }
  };

  return (
    <>
      <GlassCard className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0 rounded-full" aria-label={t('account.photo')}>
            <Avatar src={user.image} name={user.name} size={64} />
            <span className="glass absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full">
              <Camera className="size-4" aria-hidden />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onPhoto(e.target.files?.[0])} />
          <div className="min-w-0">
            <h2 className="truncate text-xl">{user.name || t('account.title')}</h2>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="text-xs text-muted">{t('account.memberSince', { date: new Date(user.createdAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })}</p>
          </div>
        </div>
        {user.image && (
          <button type="button" className="h-11 text-sm text-muted hover:text-ink" onClick={async () => (await api.setAvatar(null), refresh())}>
            {t('account.removePhoto')}
          </button>
        )}
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm font-medium">
            {t('auth.name')}
            <input className={input} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            {t('account.handicap')}
            <input className={input} inputMode="decimal" placeholder="—" value={hcp} onChange={(e) => setHcp(e.target.value)} />
          </label>
          <Button type="submit" variant="primary">
            {saved ? `✓ ${t('account.saved')}` : t('account.save')}
          </Button>
        </form>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <h2 className="px-5 pt-4 pb-1 text-sm font-semibold tracking-wide text-muted uppercase">{t('account.security')}</h2>
        {[
          { icon: KeyRound, label: user.hasPassword ? t('account.changePassword') : t('account.setPassword'), onClick: () => setPwOpen(true) },
          {
            icon: MonitorSmartphone,
            label: t('account.logoutAll'),
            onClick: async () => {
              await api.logoutAll();
              await refresh();
            },
          },
          { icon: LogOut, label: t('account.logout'), onClick: signOut },
        ].map(({ icon: Icon, label, onClick }) => (
          <button key={label} type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/30 dark:hover:bg-white/5">
            <Icon className="size-5 text-muted" aria-hidden />
            <span className="font-medium">{label}</span>
          </button>
        ))}
        <h2 className="px-5 pt-3 pb-1 text-sm font-semibold tracking-wide text-muted uppercase">{t('account.data')}</h2>
        <a href={api.exportUrl()} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-white/30 dark:hover:bg-white/5">
          <Download className="size-5 text-muted" aria-hidden />
          <span className="font-medium">{t('account.export')}</span>
        </a>
        <button type="button" onClick={() => setDelOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left text-red-700 hover:bg-red-50/50 dark:text-red-300 dark:hover:bg-red-950/30">
          <Trash2 className="size-5" aria-hidden />
          <span className="font-medium">{t('account.delete')}</span>
        </button>
      </GlassCard>

      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} needsCurrent={user.hasPassword && !params.get('motdepasse')} />
      <DeleteDialog open={delOpen} onClose={() => setDelOpen(false)} email={user.email} busy={busy} setBusy={setBusy} />
    </>
  );
}

function PasswordDialog({ open, onClose, needsCurrent }: { open: boolean; onClose: () => void; needsCurrent: boolean }) {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      await api.changePassword({ current: needsCurrent ? current : undefined, next });
      setState('done');
      await refresh();
    } catch (err) {
      setState(err instanceof ApiError ? err.code : 'error');
    }
  };
  const errKey = { wrong_password: 'account.wrongPassword', password_too_short: 'auth.err.passwordShort', password_too_weak: 'auth.err.passwordWeak' } as const;
  return (
    <Dialog open={open} onClose={onClose} title={t('account.changePassword')}>
      {state === 'done' ? (
        <Notice>{t('account.passwordChanged')}</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-3 pb-2">
          {needsCurrent && (
            <label className="block text-sm font-medium">
              {t('account.currentPassword')}
              <input className={input} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
          )}
          <label className="block text-sm font-medium">
            {t('account.newPassword')}
            <input className={input} type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-muted">{t('auth.passwordHint')}</span>
          </label>
          {!['idle', 'busy'].includes(state) && <Notice tone="error">{t(errKey[state as keyof typeof errKey] ?? 'auth.err.generic')}</Notice>}
          <Button type="submit" variant="primary" disabled={state === 'busy'}>
            {state === 'busy' && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('account.save')}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

function DeleteDialog({ open, onClose, email, busy, setBusy }: { open: boolean; onClose: () => void; email: string; busy: boolean; setBusy: (b: boolean) => void }) {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [confirm, setConfirm] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title={t('account.delete')}>
      <form
        className="space-y-3 pb-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.deleteMe(confirm);
            await refresh();
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm">{t('account.deleteConfirm')}</p>
        <input className={input} type="email" placeholder={email} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={t('auth.email')} />
        <Button type="submit" disabled={busy || confirm.trim().toLowerCase() !== email.toLowerCase()} className="w-full !bg-red-700 !text-white">
          {t('account.deleteButton')}
        </Button>
      </form>
    </Dialog>
  );
}
