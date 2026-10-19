'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { unsubscribeFromNewsletter } from '@/lib/newsletter';

/** One-click (but explicit POST, never a GET side effect) newsletter unsubscribe. */
export function UnsubscribeForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations('legal.unsubscribe');
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending' || !e.currentTarget.reportValidity()) return;
    setStatus('sending');
    try {
      await unsubscribeFromNewsletter(email.trim());
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div role="status" className="rounded-xl border border-ocean-100 bg-ocean-50/60 p-6">
        <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden="true" className="text-ocean-700" />
        <h2 className="!mt-3 text-lg font-semibold text-gray-900">{t('successTitle')}</h2>
        <p className="mt-2">{t('successBody', { email: email.trim() })}</p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-ocean-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
        >
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor={`${id}-email`} className="block text-sm font-semibold text-gray-900">
          {t('emailLabel')}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-[15px] text-gray-900 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-100 rtl:text-right"
        />
      </div>
      {status === 'error' && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm !text-red-700">
          {t('error')}
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex items-center gap-2 rounded-lg bg-ocean-700 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-70"
      >
        {status === 'sending' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {status === 'sending' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
