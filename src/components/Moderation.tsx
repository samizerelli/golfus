import { Flag } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { api, ApiError } from '../lib/api';
import { Button, Dialog, Notice } from './ui';

const REASONS = ['offensive', 'harassment', 'spam', 'false_info', 'other'] as const;
export type ReportReason = (typeof REASONS)[number];

/** Message d'erreur d'un envoi : texte refusé par le filtre de modération, sinon le message prévu par l'écran */
export function errorMessage(e: unknown, t: ReturnType<typeof useI18n>['t'], fallback: Parameters<ReturnType<typeof useI18n>['t']>[0]) {
  return e instanceof ApiError && e.code === 'inappropriate' ? t('error.inappropriate') : t(fallback);
}

/**
 * Bouton « Signaler » (avis, joueur, invitation). Chaque signalement est examiné sous 24 heures (/admin › Signalements).
 */
export function ReportButton({ kind, targetId, className = '' }: { kind: 'review' | 'user' | 'outing'; targetId: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('offensive');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center gap-1 text-xs text-muted hover:text-ink ${className}`}>
        <Flag className="size-3.5" aria-hidden /> {t('mod.report')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('mod.reportTitle')}>
        {state === 'sent' ? (
          <Notice>{t('mod.sent')}</Notice>
        ) : (
          <form
            className="space-y-3 pb-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setState('busy');
              try {
                await api.report({ kind, targetId, reason, details: details.trim() || undefined });
                setState('sent');
              } catch {
                setState('error');
              }
            }}
          >
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-semibold">{t('mod.reason')}</legend>
              {REASONS.map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-fairway-700" />
                  {t(`mod.${r}`)}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm font-semibold">
              {t('mod.details')}
              <textarea maxLength={500} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} className="mt-1.5 w-full rounded-[16px] border border-line bg-white/70 px-3 py-2.5 text-base font-normal dark:bg-white/5" />
            </label>
            {state === 'error' && <Notice tone="error">{t('auth.err.generic')}</Notice>}
            <Button type="submit" variant="primary" disabled={state === 'busy'} className="w-full">
              {t('mod.send')}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
