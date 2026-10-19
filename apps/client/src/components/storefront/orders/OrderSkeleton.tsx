import { useTranslations } from 'next-intl';

/** Placeholder while the order loads. */
export function OrderSkeleton() {
  const t = useTranslations('orderConfirmation');
  return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center animate-pulse" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4" />
      <div className="h-6 bg-gray-200 w-1/2 mx-auto mb-2" />
      <div className="h-4 bg-gray-200 w-1/3 mx-auto" />
    </div>
  );
}
