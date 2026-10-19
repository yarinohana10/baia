'use client';

import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_COLORS } from '@/components/admin/order-status';

/** Coloured pill with the translated order status. */
export function OrderStatusBadge({ status }: { status: string }) {
  const statusLabel = useOrderStatusLabel();
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full uppercase tracking-wider', ORDER_STATUS_COLORS[status])}>
      {statusLabel(status)}
    </span>
  );
}
