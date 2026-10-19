import { useTranslations } from 'next-intl';

/** Placeholder while the order and payment config load. */
export function PaymentSkeleton() {
  const t = useTranslations('payment');
  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 animate-pulse" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-8 bg-gray-200 w-1/3 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 h-96 bg-gray-100 rounded-xl" />
        <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
