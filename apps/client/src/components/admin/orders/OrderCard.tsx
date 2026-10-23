'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { draftKey } from '@/hooks/admin/order-status-edit';
import type { OrderActions } from '@/hooks/admin/useOrderActions';
import { OrderCancellationRequests } from './OrderCancellationRequests';
import { OrderCardActions } from './OrderCardActions';
import { OrderCardHeader } from './OrderCardHeader';
import { OrderCustomerBlock } from './OrderCustomerBlock';
import { OrderItemsTotals } from './OrderItemsTotals';
import { OrderPaymentBlock } from './OrderPaymentBlock';
import { OrderStatusEditor } from './OrderStatusEditor';
import { OrderStatusTimeline } from './OrderStatusTimeline';
import { refundState } from './order-utils';
import type { AdminOrder } from './types';

/** One order: who, where, what, how it was paid, its history and everything the admin can do. */
export const OrderCard = memo(function OrderCard({
  order,
  actions,
  onDetails,
}: {
  order: AdminOrder;
  actions: OrderActions;
  onDetails: (id: string) => void;
}) {
  const t = useTranslations('admin.orderCards');
  const refund = refundState(order);
  const openRequests = (order.cancellationRequests ?? []).filter((r) => r.status === 'REQUESTED');

  return (
    <Card>
      <CardContent className="space-y-4">
        <OrderCardHeader order={order} refund={refund} openRequest={openRequests.length > 0} />
        <div className="grid gap-4 sm:grid-cols-2">
          <OrderCustomerBlock order={order} />
          <OrderPaymentBlock order={order} />
        </div>
        <OrderItemsTotals order={order} />
        {refund?.kind === 'pending' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('refund.pendingNote')}
            {refund.refund.note && <span className="mt-1 block text-amber-700">{refund.refund.note}</span>}
          </p>
        )}
        {openRequests.length > 0 && <OrderCancellationRequests requests={openRequests} />}
        <OrderStatusTimeline events={order.statusEvents ?? []} />
        <div className="space-y-4 border-t border-border pt-3">
          <OrderStatusEditor key={draftKey(order)} order={order} actions={actions} />
          <OrderCardActions order={order} refund={refund} actions={actions} onDetails={onDetails} />
        </div>
      </CardContent>
    </Card>
  );
});
