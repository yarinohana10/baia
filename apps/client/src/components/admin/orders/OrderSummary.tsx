'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { formatAdminDate } from '@/lib/admin/format';
import { DetailLine } from './DetailLine';
import { OrderAddressLine } from './OrderAddressLine';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { AdminOrder } from './types';

/** Order dialog header facts: status, customer, delivery, dates and payment. */
export function OrderSummary({ order }: { order: AdminOrder }) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const locale = useLocale();

  return (
    <div className="text-sm space-y-1">
      <DetailLine label={t('status')}>
        <OrderStatusBadge status={order.status} />
      </DetailLine>
      {order.recipientName && <DetailLine label={t('recipient')}>{order.recipientName}</DetailLine>}
      {order.phone && (
        <DetailLine label={t('phone')}>
          <a href={`tel:${order.phone}`} dir="ltr" className="hover:underline">
            {order.phone}
          </a>
        </DetailLine>
      )}
      <DetailLine label={t('email')}>
        <a href={`mailto:${order.customerEmail}`} className="hover:underline">
          {order.customerEmail}
        </a>
      </DetailLine>
      <DetailLine label={t('date')}>{formatAdminDate(order.createdAt, locale, 'shortTime')}</DetailLine>
      <DetailLine label={tx('delivery')}>
        {order.deliveryMethod === 'PICKUP_POINT' ? tx('pickup') : tx('courier')}
      </DetailLine>
      <OrderAddressLine order={order} />
      {order.paidAt && <DetailLine label={tx('paidAt')}>{formatAdminDate(order.paidAt, locale, 'shortTime')}</DetailLine>}
      {order.shippedAt && (
        <DetailLine label={tx('shippedAt')}>{formatAdminDate(order.shippedAt, locale, 'shortTime')}</DetailLine>
      )}
      {order.cancelledAt && (
        <DetailLine label={tx('cancelledAt')}>{formatAdminDate(order.cancelledAt, locale, 'shortTime')}</DetailLine>
      )}
      <p className="flex items-center gap-1.5">
        <Mail size={12} className="text-muted-foreground" />
        <span className="text-muted-foreground">{tx('marketing')}:</span>{' '}
        {order.marketingConsent ? tx('marketingYes') : tx('marketingNo')}
      </p>
      {order.paymentRef && <DetailLine label={t('payment')}>{order.paymentRef}</DetailLine>}
    </div>
  );
}
