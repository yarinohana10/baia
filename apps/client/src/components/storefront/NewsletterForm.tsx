'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { newsletterSubscribeSchema } from '@baia/shared';
import { subscribeToNewsletter } from '@/lib/newsletter';
import { validateForm } from '@/lib/form-errors';

/**
 * Footer newsletter opt-in. The consent box is never pre-ticked and the API
 * rejects anything but an explicit `consent: true` (חוק התקשורת, סעיף 30א).
 */
export function NewsletterForm() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const check = validateForm(newsletterSubscribeSchema, { email, consent, source: 'footer' });
    if (!check.success) {
      return setError(t(check.errors.email ? 'newsletterInvalidEmail' : 'newsletterConsentRequired'));
    }
    setError(null);
    setStatus('sending');
    try {
      await subscribeToNewsletter(check.data.email, locale, 'footer');
      setStatus('done');
    } catch {
      setStatus('idle');
      setError(t('newsletterError'));
    }
  };

  if (status === 'done') {
    return (
      <div role="status" className="mt-4 flex items-start gap-3">
        <CheckCircle2 size={20} strokeWidth={1.6} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-200" />
        <div>
          <p className="text-sm font-semibold">{t('newsletterSuccessTitle')}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/65">{t('newsletterSuccess')}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3" aria-describedby={error ? `${id}-error` : undefined}>
      <div className="flex gap-2">
        <label htmlFor={`${id}-email`} className="sr-only">
          {t('newsletterEmailLabel')}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('newsletterEmailPlaceholder')}
          aria-invalid={error === t('newsletterInvalidEmail') || undefined}
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none rtl:text-right"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ocean-800 transition-colors hover:bg-ocean-100 disabled:opacity-70"
        >
          {status === 'sending' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {status === 'sending' ? t('newsletterSubmitting') : t('newsletterSubmit')}
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={error === t('newsletterConsentRequired') || undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/30 accent-ocean-300"
        />
        <label htmlFor={`${id}-consent`} className="cursor-pointer text-xs leading-relaxed text-white/70">
          {t('newsletterConsent')}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-amber-200">
          {error}
        </p>
      )}
    </form>
  );
}
