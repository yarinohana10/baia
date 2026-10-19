'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/store/cart';
import { useGuestOrder } from '@/hooks/storefront/useGuestOrder';
import { OrderDetails } from './OrderDetails';
import { OrderNotFound } from './OrderNotFound';
import { OrderSkeleton } from './OrderSkeleton';

/**
 * Order page (after checkout, from emails and from the order lookup). Access
 * rules are enforced by the API (owner session, guest token, or admin; 404
 * otherwise); guests' tokens arrive in the URL fragment, so the order loads
 * in the browser (see useGuestOrder).
 */
export function OrderConfirmationView({ orderId }: { orderId: string }) {
  const fetchShipping = useCartStore((s) => s.fetchShipping);
  const { order, notFound, guestToken, setOrder } = useGuestOrder(orderId);

  // Delivery estimates come from the shop's shipping settings.
  useEffect(() => {
    fetchShipping();
  }, [fetchShipping]);

  if (notFound) return <OrderNotFound />;
  if (!order) return <OrderSkeleton />;
  return <OrderDetails order={order} guestToken={guestToken} onUpdated={setOrder} />;
}
