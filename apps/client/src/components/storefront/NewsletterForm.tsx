'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
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
        <CheckCircle2 size={20} strokeWidth={1.6} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
        <div>
          <p className="text-sm font-semibold">{t('newsletterSuccessTitle')}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-black/65">{t('newsletterSuccess')}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4" aria-describedby={error ? `${id}-error` : undefined}>
      <div className="flex items-center border-b border-black">
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
          className="min-w-0 flex-1 bg-transparent py-3 text-[14px] text-black placeholder:text-black/45 focus:outline-none rtl:text-right"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          aria-label={t('newsletterSubmit')}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center text-black transition-opacity hover:opacity-60 disabled:opacity-40"
        >
          {status === 'sending' ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <>
              <ArrowLeft size={20} strokeWidth={1.4} className="ltr:hidden" aria-hidden="true" />
              <ArrowRight size={20} strokeWidth={1.4} className="rtl:hidden" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={error === t('newsletterConsentRequired') || undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-black"
        />
        <label htmlFor={`${id}-consent`} className="cursor-pointer text-xs leading-relaxed text-black/65">
          {t('newsletterConsent')}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
