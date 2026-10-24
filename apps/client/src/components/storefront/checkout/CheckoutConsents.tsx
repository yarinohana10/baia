'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { FieldIssue } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';

const legalLinkClass = 'underline text-black hover:text-black';

/** Marketing opt-in and the required terms & privacy checkbox (shown ticked once the order exists). */
export function CheckoutConsents({
  marketingConsent,
  termsAccepted,
  termsIssue,
  locked,
  onMarketingChange,
  onTermsChange,
}: {
  marketingConsent: boolean;
  termsAccepted: boolean;
  termsIssue: FieldIssue | undefined;
  locked: boolean;
  onMarketingChange: (value: boolean) => void;
  onTermsChange: (value: boolean) => void;
}) {
  const t = useTranslations('checkout');
  return (
    <div className="space-y-3 border-t border-gray-200 pt-4">
      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => onMarketingChange(e.target.checked)}
          disabled={locked}
          className="mt-0.5 accent-black"
        />
        <span>{t('marketingConsent')}</span>
      </label>
      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={termsAccepted || locked}
          onChange={(e) => onTermsChange(e.target.checked)}
          disabled={locked}
          required
          className="mt-0.5 accent-black"
        />
        <span>
          {t.rich('termsConsent', {
            terms: (chunks) => (
              <Link href="/terms" target="_blank" className={legalLinkClass}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" target="_blank" className={legalLinkClass}>
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      <FieldError id="checkout-terms-error" issue={termsIssue} className="text-red-500" />
    </div>
  );
}
