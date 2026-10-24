'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isClosed, stepDate, timelineIndex, TIMELINE_STEPS, type CustomerOrder } from '@/lib/orders';
import { DAY_MONTH, formatOrderDate } from './order-dates';

/**
 * התקבלה → שולמה → בטיפול → נשלחה → נמסרה, or a "cancelled" banner.
 * `compact` drops the dates (account orders list).
 */
export function OrderTimeline({
  order,
  compact = false,
}: {
  order: Pick<CustomerOrder, 'status' | 'createdAt' | 'paidAt' | 'shippedAt' | 'cancelledAt' | 'refunds'> &
    Partial<Pick<CustomerOrder, 'deliveredAt' | 'statusEvents'>>;
  compact?: boolean;
}) {
  const t = useTranslations('orderPage.timeline');
  const locale = useLocale();

  if (isClosed(order.status)) {
    return (
      <div className="flex items-center gap-2 rounded-none bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <XCircle size={16} aria-hidden="true" className="shrink-0 text-gray-400" />
        <span>
          {order.status === 'REFUNDED' ? t('refunded') : t('cancelled')}
          {order.cancelledAt && !compact && (
            <span className="text-gray-400"> · {formatOrderDate(DAY_MONTH, order.cancelledAt, locale)}</span>
          )}
        </span>
      </div>
    );
  }

  const current = timelineIndex(order.status);
  return (
    <ol className="flex items-start" aria-label={t('label')}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= current;
        const date = stepDate(order, step);
        return (
          <li
            key={step}
            className="relative flex flex-1 flex-col items-center text-center"
            aria-current={i === current ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-3 h-0.5 w-full -translate-y-1/2 ltr:right-1/2 rtl:left-1/2',
                  i <= current ? 'bg-neutral-800' : 'bg-gray-200',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold',
                done ? 'border-neutral-700 bg-neutral-800 text-white' : 'border-gray-200 bg-white text-gray-400',
                i === current && 'ring-4 ring-neutral-200',
              )}
            >
              {done ? <Check size={12} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('mt-1.5 text-[11px] leading-tight sm:text-xs', done ? 'font-medium text-gray-900' : 'text-gray-400')}>
              {t(step)}
              <span className="sr-only">{done ? ` (${t('done')})` : ''}</span>
            </span>
            {!compact && done && date && (
              <span className="text-[10px] text-gray-400" dir="ltr">
                {formatOrderDate(DAY_MONTH, date, locale)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
