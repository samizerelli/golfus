import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BackLink } from '../components/BackLink';
import { Button, Notice } from '../components/ui';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const TOPICS = ['question', 'bug', 'account', 'content', 'privacy', 'other'] as const;
const FAQ = [1, 2, 3, 4, 5, 6] as const;
const input = 'mt-1.5 w-full rounded-[16px] border border-line bg-white/70 px-3 text-base font-normal dark:bg-white/5';

/** Aide et contact : questions fréquentes et formulaire (lu dans /admin › Messages). Adresse « Support » de l'App Store. */
export function SupportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('question');
  const [message, setMessage] = useState('');
  const send = useMutation({ mutationFn: () => api.contact({ email, topic, message }) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto w-[calc(100%-1.5rem)] max-w-2xl space-y-4 pt-2 pb-32">
        <BackLink />
        <h1 className="text-[28px] leading-tight">{t('help.title')}</h1>

        <section className="glass glass-rounded space-y-1 p-5" aria-labelledby="faq">
          <h2 id="faq" className="mb-2 text-lg font-semibold">{t('help.faq')}</h2>
          {FAQ.map((n) => (
            <details key={n} className="group border-b border-[var(--line)] py-2 last:border-0">
              <summary className="flex min-h-11 cursor-pointer items-center font-medium">{t(`help.q${n}`)}</summary>
              <p className="pb-2 text-sm text-muted">{t(`help.a${n}`)}</p>
            </details>
          ))}
        </section>

        <section className="glass glass-rounded p-5" aria-labelledby="contact">
          <h2 id="contact" className="text-lg font-semibold">{t('help.contact')}</h2>
          <p className="mb-3 text-sm text-muted">{t('help.contactIntro')}</p>
          {send.isSuccess ? (
            <Notice>{t('help.sent')}</Notice>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm font-semibold">
                {t('auth.email')}
                <input type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} h-12`} />
              </label>
              <label className="block text-sm font-semibold">
                {t('help.topic')}
                <select value={topic} onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number])} className={`${input} h-12`}>
                  {TOPICS.map((k) => (
                    <option key={k} value={k}>
                      {t(`help.topic.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {t('help.message')}
                <textarea required minLength={5} maxLength={3000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={`${input} py-2.5`} />
              </label>
              {send.isError && <Notice tone="error">{t('auth.err.generic')}</Notice>}
              <Button type="submit" variant="primary" disabled={send.isPending} className="w-full">
                {t('help.send')}
              </Button>
            </form>
          )}
        </section>

        <p className="flex flex-wrap gap-x-4 px-1 text-sm">
          <Link to="/conditions" className="text-link underline underline-offset-2">{t('nav.terms')}</Link>
          <Link to="/confidentialite" className="text-link underline underline-offset-2">{t('nav.privacy')}</Link>
          <Link to="/mentions-legales" className="text-link underline underline-offset-2">{t('nav.legal')}</Link>
        </p>
      </div>
    </div>
  );
}
