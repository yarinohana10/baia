import { useTranslations } from 'next-intl';

/** Placeholder until the cart has loaded. */
export function CheckoutSkeleton() {
  const t = useTranslations('checkout');
  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 animate-pulse" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-8 bg-gray-200 w-1/4 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
