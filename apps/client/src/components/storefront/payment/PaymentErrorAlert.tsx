import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { PayError } from '@/hooks/storefront/paymentState';

/** Why the last payment attempt failed (and, after a decline, that the order is kept). */
export function PaymentErrorAlert({ error }: { error: PayError }) {
  const t = useTranslations('payment');
  const tErrors = useTranslations('checkout.errors');
  return (
    <div
      role="alert"
      className="mb-5 rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p>{error.ns === 'payment' ? t(`errors.${error.key}`) : tErrors(error.key, error.values)}</p>
        {error.kept && <p className="text-xs text-red-600/80 mt-1">{t('errors.keptOrder')}</p>}
      </div>
    </div>
  );
}
