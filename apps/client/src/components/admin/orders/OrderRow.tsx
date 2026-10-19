'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Eye, Home, MapPin, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAdminDate } from '@/lib/admin/format';
import { cn } from '@/lib/utils';
import { formatShekels as money } from '@/components/admin/order-status';
import { OrderStatusBadge } from './OrderStatusBadge';
import { hasOpenCancellationRequest, orderItemCount } from './order-utils';
import type { AdminOrder } from './types';

/** One order in the admin orders table. */
export function OrderRow({
  order,
  onView,
}: {
  order: AdminOrder;
  onView: (id: string, trigger: HTMLElement) => void;
}) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const locale = useLocale();
  const pickup = order.deliveryMethod === 'PICKUP_POINT';

  return (
    <tr className="border-b border-border hover:bg-muted/50">
      <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {order.recipientName && <div className="text-foreground">{order.recipientName}</div>}
        <div className={cn(order.recipientName && 'text-xs')}>{order.customerEmail}</div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{orderItemCount(order)}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        <span className="inline-flex items-center gap-1">
          {pickup ? <MapPin size={12} /> : <Home size={12} />}
          {pickup ? tx('pickupShort') : tx('courierShort')}
        </span>
        <div className="truncate max-w-[140px]">{order.shippingCity}</div>
      </td>
      <td className="px-4 py-3 font-medium">{money(order.total)}</td>
      <td className="px-4 py-3">
        <OrderStatusBadge status={order.status} />
        {hasOpenCancellationRequest(order) && (
          <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            <Undo2 size={10} /> {tx('openRequestBadge')}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{formatAdminDate(order.createdAt, locale, 'short')}</td>
      <td className="px-4 py-3 text-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(e) => onView(order.id, e.currentTarget)}
          className="text-muted-foreground hover:text-ocean-600"
          aria-label={t('viewDetails')}
        >
          <Eye size={14} />
        </Button>
      </td>
    </tr>
  );
}
