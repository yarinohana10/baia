import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** The order doesn't exist or this viewer may not see it. */
export function OrderNotFound() {
  const t = useTranslations('orderConfirmation');
  const tPage = useTranslations('orderPage');
  return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center">
      <SearchX size={56} className="mx-auto text-gray-300 mb-6" />
      <h1 className="mb-2 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{t('notFoundTitle')}</h1>
      <p className="text-gray-500 mb-8">{tPage('notFoundBody')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/order-status"
          className="inline-block px-6 py-2.5 text-sm bg-black text-white rounded-none hover:bg-neutral-800 transition-colors"
        >
          {tPage('findOrder')}
        </Link>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 text-sm border border-gray-300 rounded-none hover:bg-gray-50 transition-colors"
        >
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  );
}
