'use client';

import { useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { formatShekels as money, ORDER_STATUS_COLORS, ORDER_STATUS_LABEL_KEYS } from '@/components/admin/order-status';
import { elapsedSince, type AdminCancellation, type RequestStatus } from './types';

const STATUS_STYLES: Record<RequestStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-muted text-muted-foreground',
  AUTO_CANCELLED: 'bg-blue-50 text-blue-700',
};

const isKnownOrderStatus = (s: string): s is keyof typeof ORDER_STATUS_LABEL_KEYS => s in ORDER_STATUS_LABEL_KEYS;

/** Order number, request and order status, customer contact, total and age. */
export function CancellationHeader({ request }: { request: AdminCancellation }) {
  const t = useTranslations('admin.cancellations');
  const tOrders = useTranslations('admin.orders');
  const { order } = request;
  const phone = request.contactPhone || order.phone;
  const elapsed = elapsedSince(order.paidAt ?? order.createdAt);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
            className="font-mono text-sm font-semibold text-foreground hover:text-ocean-700 hover:underline"
            dir="ltr"
          >
            {order.orderNumber}
          </Link>
          <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_STYLES[request.status])}>{t(`status.${request.status}`)}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs uppercase tracking-wider', ORDER_STATUS_COLORS[order.status] || '')}>
            {isKnownOrderStatus(order.status) ? tOrders(ORDER_STATUS_LABEL_KEYS[order.status]) : order.status}
          </span>
        </div>
        <p className="text-sm text-foreground">
          {order.recipientName ?? order.customerEmail}
          {order.recipientName && <span className="text-muted-foreground"> · {order.customerEmail}</span>}
        </p>
        {phone && (
          <a href={`tel:${phone}`} dir="ltr" className="inline-flex items-center gap-1 text-sm text-ocean-700 hover:underline">
            <Phone size={12} /> {phone}
          </a>
        )}
      </div>
      <div className="text-end">
        <p className="font-serif text-xl text-foreground">{money(order.total)}</p>
        <p className="text-xs text-muted-foreground">
          {t('orderedAgo', { time: t(`elapsed.${elapsed.unit}`, { count: elapsed.count }) })}
        </p>
      </div>
    </div>
  );
}
