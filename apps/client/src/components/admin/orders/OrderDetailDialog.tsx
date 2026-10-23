'use client';

import { useTranslations } from 'next-intl';
import { OrderEmailsPanel } from '@/components/admin/OrderEmailsPanel';
import { OrderPaymentPanel } from '@/components/admin/OrderPaymentPanel';
import { OrderCancellationRequests } from './OrderCancellationRequests';
import { OrderModal } from './OrderModal';
import { OrderSummary } from './OrderSummary';
import type { AdminOrder } from './types';

/**
 * Modal with the details a card does not show: every cancellation request (with the
 * admin's notes), the payment attempts and the log of emails sent about the order.
 */
export function OrderDetailDialog({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const t = useTranslations('admin.orderCards');
  const requests = order.cancellationRequests ?? [];

  return (
    <OrderModal title={<span className="font-mono">{order.orderNumber}</span>} description={t('detailsHint')} onClose={onClose}>
      <div className="space-y-4">
        <OrderSummary order={order} />
        <OrderPaymentPanel orderId={order.id} refreshKey={order.status} />
        <OrderEmailsPanel orderId={order.id} customerEmail={order.customerEmail} canResend={false} refreshKey={order.status} />
        {requests.length > 0 && <OrderCancellationRequests requests={requests} />}
      </div>
    </OrderModal>
  );
}
