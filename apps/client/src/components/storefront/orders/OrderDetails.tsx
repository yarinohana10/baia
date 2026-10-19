'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import type { CustomerOrder } from '@/lib/orders';
import { CancellationOutcome } from './CancellationOutcome';
import { OrderActions } from './OrderActions';
import { OrderCancellation } from './OrderCancellation';
import { OrderDelivery } from './OrderDelivery';
import { OrderHeading } from './OrderHeading';
import { OrderLines } from './OrderLines';
import { OrderNumberHeader } from './OrderNumberHeader';
import { OrderTimeline } from './OrderTimeline';
import { OrderTotals } from './OrderTotals';
import { OrderTracking } from './OrderTracking';
import { PaymentMethodLine } from './PaymentMethodLine';
import { orderPhase, viewerAccess, type Viewer } from './order-view';

/** A loaded order: status, timeline, delivery, lines, payment, totals, cancellation and next steps. */
export function OrderDetails({
  order,
  guestToken,
  onUpdated,
}: {
  order: CustomerOrder;
  guestToken: string | null;
  onUpdated: (order: CustomerOrder) => void;
}) {
  const t = useTranslations('orderConfirmation');
  const { data: session } = useSession();
  const viewer: Viewer = session?.user as Viewer;
  const phase = orderPhase(order.status);
  const access = viewerAccess(order, viewer, guestToken);
  const statusLabel = t.has(`status.${order.status}`) ? t(`status.${order.status}`) : order.status;

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <OrderHeading order={order} phase={phase} statusLabel={statusLabel} />

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 mb-6 mt-6">
        <OrderNumberHeader order={order} phase={phase} statusLabel={statusLabel} />

        <div className="border-t border-gray-100 pt-5">
          <OrderTimeline order={order} />
        </div>

        <OrderDelivery order={order} showEta={phase.notYetShipped && !phase.closed} />
        {order.trackingNumber && <OrderTracking trackingNumber={order.trackingNumber} />}
        <OrderLines items={order.items} />
        <PaymentMethodLine order={order} className="border-t border-gray-100 pt-4 text-sm" />
        <OrderTotals order={order} />
        <CancellationOutcome requests={order.cancellationRequests ?? []} closed={phase.closed} />
      </div>

      {access.canCancel && !phase.closed && (
        <div className="mb-6">
          <OrderCancellation order={order} token={guestToken} onUpdated={onUpdated} />
        </div>
      )}

      <OrderActions orderId={order.id} guestToken={guestToken} canPay={access.canPay} signedIn={!!session?.user} />
    </div>
  );
}
