import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PayError } from '@/hooks/storefront/paymentState';

/** The order is no longer awaiting payment: already paid, or cancelled. Links to the order page. */
export function PaymentUnavailable({
  alreadyPaid,
  error,
  orderHref,
}: {
  alreadyPaid: boolean;
  error: PayError | null;
  orderHref: string;
}) {
  const t = useTranslations('payment');
  const tErrors = useTranslations('checkout.errors');
  return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center" role="status">
      {alreadyPaid ? (
        <CheckCircle2 size={56} className="mx-auto text-green-500 mb-6" aria-hidden="true" />
      ) : (
        <AlertTriangle size={56} className="mx-auto text-gray-300 mb-6" aria-hidden="true" />
      )}
      <p className="text-gray-600 mb-8">{alreadyPaid ? t('alreadyPaid') : t('notPayable')}</p>
      {error && <p className="text-sm text-red-600 mb-6">{tErrors(error.key, error.values)}</p>}
      <Link
        href={orderHref}
        className="inline-block px-6 py-2.5 text-sm bg-black text-white rounded-none hover:bg-neutral-800 transition-colors"
      >
        {t('viewOrder')}
      </Link>
    </div>
  );
}
