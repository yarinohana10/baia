'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cookie } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { readConsent, writeConsent, type ConsentChoice } from '@/lib/consent';

/**
 * Minimal, non-blocking cookie notice. Shows until the visitor picks
 * "essential only" or "accept all"; the choice lives in the `baia_consent`
 * cookie (see lib/consent.ts -> hasAnalyticsConsent()).
 */
export function CookieConsent() {
  const t = useTranslations('legal.cookies');
  const [open, setOpen] = useState(false);

  // Read after mount so server and client markup match.
  useEffect(() => {
    setOpen(readConsent() === null);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    writeConsent(choice);
    setOpen(false);
  };

  return (
    <section
      aria-label={t('label')}
      className="fixed inset-x-3 bottom-3 z-[45] mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl shadow-black/10 print:hidden sm:inset-x-auto sm:end-6 sm:bottom-6 sm:mx-0 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
          <Cookie size={18} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
            {t('body')}{' '}
            <Link href="/privacy#cookies" className="font-medium text-ocean-700 underline underline-offset-4 hover:text-ocean-600">
              {t('privacyLink')}
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => choose('essential')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('essentialOnly')}
        </button>
        <button
          type="button"
          onClick={() => choose('all')}
          className="rounded-lg bg-ocean-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
        >
          {t('acceptAll')}
        </button>
      </div>
    </section>
  );
}
