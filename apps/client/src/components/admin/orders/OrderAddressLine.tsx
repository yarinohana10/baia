'use client';

import { useTranslations } from 'next-intl';
import { DetailLine } from './DetailLine';
import type { AdminOrder } from './types';

/** Shipping address line: the pickup point, or street / apartment / city / zip. */
export function OrderAddressLine({ order }: { order: AdminOrder }) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  if (order.deliveryMethod === 'PICKUP_POINT') {
    return (
      <DetailLine label={tx('pickupPoint')}>
        {order.pickupPointName ? `${order.pickupPointName} — ` : ''}
        {order.shippingStreet}, {order.shippingCity}
      </DetailLine>
    );
  }
  return (
    <DetailLine label={t('address')}>
      {order.shippingStreet} {order.shippingNumber}
      {order.shippingApartment ? `, ${t('apt')} ${order.shippingApartment}` : ''},{' '}
      {order.shippingCity}
      {order.shippingZip ? ` ${order.shippingZip}` : ''}
    </DetailLine>
  );
}
