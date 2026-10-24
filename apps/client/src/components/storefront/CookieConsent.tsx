'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cookie } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { writeConsent, type ConsentChoice } from '@/lib/consent';
import { useConsentChoice } from '@/hooks/storefront/useConsentChoice';

/**
 * Minimal, non-blocking cookie notice. Shows until the visitor picks
 * "essential only" or "accept all"; the choice lives in the `baia_consent`
 * cookie (see lib/consent.ts -> hasAnalyticsConsent()).
 */
export function CookieConsent() {
  const t = useTranslations('legal.cookies');
  // `undefined` until hydrated (no banner in the server markup), then the cookie's value.
  const consent = useConsentChoice();
  // Also hides the banner when the browser refuses the cookie.
  const [dismissed, setDismissed] = useState(false);

  if (consent !== null || dismissed) return null;

  const choose = (choice: ConsentChoice) => {
    writeConsent(choice);
    setDismissed(true);
  };

  return (
    <section
      aria-label={t('label')}
      className="fixed inset-x-3 bottom-3 z-[45] mx-auto max-w-xl rounded-none border border-gray-200 bg-white p-4 shadow-xl shadow-black/10 print:hidden sm:inset-x-auto sm:end-6 sm:bottom-6 sm:mx-0 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7F7F7] text-black">
          <Cookie size={18} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
            {t('body')}{' '}
            <Link href="/privacy#cookies" className="font-medium text-black underline underline-offset-4 hover:text-neutral-700">
              {t('privacyLink')}
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => choose('essential')}
          className="rounded-none border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('essentialOnly')}
        </button>
        <button
          type="button"
          onClick={() => choose('all')}
          className="rounded-none bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          {t('acceptAll')}
        </button>
      </div>
    </section>
  );
}
