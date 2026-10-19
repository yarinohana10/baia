'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CustomerOrder } from '@/lib/orders';
import { formatOrderDate, ORDER_DATE_TIME } from './order-dates';
import type { OrderPhase } from './order-view';

/** Order number, date and the status badge. */
export function OrderNumberHeader({
  order,
  phase,
  statusLabel,
}: {
  order: CustomerOrder;
  phase: OrderPhase;
  statusLabel: string;
}) {
  const t = useTranslations('orderConfirmation');
  const locale = useLocale();
  let badgeClass = 'bg-amber-50 text-amber-600';
  if (phase.paid) badgeClass = 'bg-green-50 text-green-600';
  else if (phase.closed) badgeClass = 'bg-gray-100 text-gray-500';
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-gray-400">{t('orderNumber')}</p>
        <p className="font-mono text-lg font-semibold" dir="ltr">{order.orderNumber}</p>
        <p className="text-xs text-gray-400">{formatOrderDate(ORDER_DATE_TIME, order.createdAt, locale)}</p>
      </div>
      <span className={`text-xs px-3 py-1 uppercase tracking-wider rounded-full ${badgeClass}`}>{statusLabel}</span>
    </div>
  );
}
