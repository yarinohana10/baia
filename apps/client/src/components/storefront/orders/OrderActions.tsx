'use client';

import { useTranslations } from 'next-intl';
import { CreditCard, Package } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { paymentPageHref } from '@/components/storefront/payment/links';

const primaryClass =
  'flex items-center gap-2 px-6 py-2.5 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors';

/** Complete payment (when payable), continue shopping, and my orders / track another order. */
export function OrderActions({
  orderId,
  guestToken,
  canPay,
  signedIn,
}: {
  orderId: string;
  guestToken: string | null;
  canPay: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations('orderConfirmation');
  const tPage = useTranslations('orderPage');
  const tOrders = useTranslations('orders');
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {canPay && (
        // The payment page reuses the token (guests) or the order cookie / session.
        <Link href={paymentPageHref(orderId, guestToken)} className={primaryClass}>
          <CreditCard size={14} /> {tOrders('completePayment')}
        </Link>
      )}
      <Link href="/" className="px-6 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        {t('continueShopping')}
      </Link>
      {signedIn ? (
        <Link href="/account/orders" className={primaryClass}>
          <Package size={14} /> {t('myOrders')}
        </Link>
      ) : (
        <Link href="/order-status" className="text-sm text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
          {tPage('trackAnother')}
        </Link>
      )}
    </div>
  );
}
