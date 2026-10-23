'use client';

import { useTranslations } from 'next-intl';
import { PaymentMethodLine } from '@/components/storefront/orders/PaymentMethodLine';
import { DetailLine } from './DetailLine';
import type { AdminOrder } from './types';

/** Payment method (card brand / last4 / installments), payment reference and tracking number. */
export function OrderPaymentBlock({ order }: { order: AdminOrder }) {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.orderCards');
  const hasMethod = !!order.paymentMethod;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{t('payment')}:</span>
        {hasMethod ? (
          <PaymentMethodLine order={order} className="flex items-center gap-1" compact />
        ) : (
          <span className="text-muted-foreground">{tc('paymentNotRecorded')}</span>
        )}
      </div>
      {order.paymentRef && (
        <DetailLine label={tc('paymentRef')}>
          <span dir="ltr" className="break-all font-mono text-xs">
            {order.paymentRef}
          </span>
        </DetailLine>
      )}
      {order.trackingNumber && (
        <DetailLine label={t('trackingNumber')}>
          <span dir="ltr" className="font-mono text-xs">
            {order.trackingNumber}
          </span>
        </DetailLine>
      )}
    </div>
  );
}
