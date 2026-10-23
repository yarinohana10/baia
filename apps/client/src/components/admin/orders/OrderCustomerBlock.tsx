'use client';

import { useTranslations } from 'next-intl';
import { DetailLine } from './DetailLine';
import { OrderAddressLine } from './OrderAddressLine';
import type { AdminOrder } from './types';

/** Customer name / email / phone and where the order goes (address or pickup point). */
export function OrderCustomerBlock({ order }: { order: AdminOrder }) {
  const tx = useTranslations('admin.ordersExtra');

  return (
    <div className="space-y-1 text-sm">
      {order.recipientName && <p className="font-medium text-foreground">{order.recipientName}</p>}
      <p>
        <a href={`mailto:${order.customerEmail}`} className="break-all hover:underline">
          {order.customerEmail}
        </a>
      </p>
      {order.phone && (
        <p>
          <a href={`tel:${order.phone}`} dir="ltr" className="inline-block hover:underline">
            {order.phone}
          </a>
        </p>
      )}
      <DetailLine label={tx('delivery')}>{order.deliveryMethod === 'PICKUP_POINT' ? tx('pickup') : tx('courier')}</DetailLine>
      <OrderAddressLine order={order} />
    </div>
  );
}
