'use client';

import { useReducer } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { orderPageHref } from '@/lib/orders';
import type { PayRequest } from '@/lib/payment';
import { initialPaymentState, payFailure, paymentReducer } from './paymentState';

/**
 * Paying an order on the hosted payment page: POST /orders/:id/pay (guests
 * also send their token; the order cookie works too), then on to the order
 * page. Declines keep the order and reset the card form for another card.
 */
export function usePayment({
  orderId,
  guestToken,
  onNotPayable,
}: {
  orderId: string;
  guestToken: string | null;
  /** The order changed under us (paid elsewhere, cancelled): reload it. */
  onNotPayable: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [state, dispatch] = useReducer(paymentReducer, initialPaymentState);

  const pay = async (body: PayRequest) => {
    if (state.paying) return;
    dispatch({ type: 'start' });
    try {
      await api.post(
        `/orders/${encodeURIComponent(orderId)}/pay`,
        body,
        guestToken ? { headers: { 'X-Order-Token': guestToken } } : undefined,
      );
    } catch (err) {
      const failure = payFailure(err, locale);
      dispatch({ type: 'failed', error: failure.error, declined: failure.declined });
      if (failure.notPayable) onNotPayable();
      return;
    }
    dispatch({ type: 'succeeded' });
    // The confirmation page exchanges the token again (or uses the cookie).
    router.replace(orderPageHref(orderId, guestToken));
  };

  return { state, dispatch, pay };
}
