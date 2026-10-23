'use client';

import { useRouter } from '@/i18n/navigation';
import { orderPageHref } from '@/lib/orders';
import { useGuestOrder } from '@/hooks/storefront/useGuestOrder';
import { usePaymentConfig } from '@/hooks/storefront/usePaymentConfig';
import { PaymentsComingSoon } from '../checkout/PaymentsComingSoon';
import { PaymentNotFound } from './PaymentNotFound';
import { PaymentSkeleton } from './PaymentSkeleton';
import { PaymentStep } from './PaymentStep';
import { isPaid } from './payment-status';

/**
 * Hosted-payment-page step (emulates an Israeli PSP page such as Grow,
 * PayPlus, Tranzila or CardCom). Card details never leave this page: the API
 * only receives the method, installments, brand and last 4 digits, plus the
 * test-card outcome while the mock provider is bound.
 *
 * Guests arrive with `#token=...`, exchanged for the order cookie (scoped to
 * /v1/orders/:id), so a refresh keeps access and paying goes through
 * POST /orders/:id/pay where that cookie is sent.
 */
export function PaymentView({ orderId }: { orderId: string }) {
  const router = useRouter();
  // An order that is already paid (paid in another tab, or the back button
  // after paying) belongs on its order page: go there as soon as it loads.
  const { order, notFound, guestToken, refresh } = useGuestOrder(orderId, (loaded, token) => {
    if (isPaid(loaded)) router.replace(orderPageHref(loaded.id, token));
  });
  const config = usePaymentConfig();

  if (notFound) return <PaymentNotFound />;
  if (!order || !config) return <PaymentSkeleton />;
  if (!config.enabled && order.status === 'PENDING_PAYMENT') return <PaymentsComingSoon />;
  return <PaymentStep order={order} config={config} guestToken={guestToken} onNotPayable={refresh} />;
}
