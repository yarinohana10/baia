'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';
import { formatAdminDate } from '@/lib/admin/format';
import { OrderRefundChip } from './OrderRefundChip';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { RefundState } from './order-utils';
import type { AdminOrder } from './types';

/** Order number, date, status chip, refund chip and the open-cancellation-request flag. */
export function OrderCardHeader({
  order,
  refund,
  openRequest,
}: {
  order: AdminOrder;
  refund: RefundState | null;
  openRequest: boolean;
}) {
  const tx = useTranslations('admin.ordersExtra');
  const locale = useLocale();

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-mono text-xl font-semibold text-foreground" dir="ltr">
          {order.orderNumber}
        </h2>
        <time dateTime={order.createdAt} className="text-xs text-muted-foreground">
          {formatAdminDate(order.createdAt, locale, 'shortTime')}
        </time>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        {refund && <OrderRefundChip state={refund} />}
        {openRequest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            <Undo2 size={11} aria-hidden="true" /> {tx('openRequestBadge')}
          </span>
        )}
      </div>
    </header>
  );
}
