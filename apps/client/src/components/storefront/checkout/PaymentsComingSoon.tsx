'use client';

import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Shown instead of checkout / the payment step while the server's payments
 * flag is off. The cart stays usable; the server refuses orders regardless.
 */
export function PaymentsComingSoon({ showCartLink = true }: { showCartLink?: boolean }) {
  const t = useTranslations('checkout.paymentsComingSoon');
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center" role="status">
      <Clock size={48} strokeWidth={1.5} aria-hidden="true" className="mx-auto mb-5 text-black" />
      <h1 className="mb-3 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{t('title')}</h1>
      <p className="text-gray-600 mb-8">{t('body')}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {showCartLink && (
          <Link
            href="/cart"
            className="px-6 py-2.5 text-sm border border-gray-300 rounded-none hover:bg-gray-50 transition-colors"
          >
            {t('backToCart')}
          </Link>
        )}
        <Link
          href="/"
          className="px-6 py-2.5 text-sm bg-black text-white rounded-none hover:bg-neutral-800 transition-colors"
        >
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  );
}
