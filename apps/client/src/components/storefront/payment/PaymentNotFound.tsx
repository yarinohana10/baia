import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** The order doesn't exist or this viewer may not pay it. */
export function PaymentNotFound() {
  const t = useTranslations('payment');
  return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center">
      <SearchX size={56} className="mx-auto text-gray-300 mb-6" aria-hidden="true" />
      <p className="text-gray-500 mb-8">{t('notPayable')}</p>
      <Link
        href="/order-status"
        className="inline-block px-6 py-2.5 text-sm bg-black text-white rounded-none hover:bg-neutral-800 transition-colors"
      >
        {t('viewOrder')}
      </Link>
    </div>
  );
}
