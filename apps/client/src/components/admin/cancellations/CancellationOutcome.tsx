'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatAdminDate } from '@/lib/admin/format';
import { formatShekels as money } from '@/components/admin/order-status';
import type { AdminCancellation } from './types';

/** How a closed request was resolved: when, refund and fee, and the admin's note. */
export function CancellationOutcome({ request }: { request: AdminCancellation }) {
  const t = useTranslations('admin.cancellations');
  const locale = useLocale();
  // The order is still CANCELLED (not REFUNDED): the money is owed until an admin confirms it in Orders.
  const refundPending = !!request.refundAmount && request.order.status === 'CANCELLED';
  return (
    <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
      {request.resolvedAt && <p>{t('resolvedAt', { date: formatAdminDate(request.resolvedAt, locale, 'shortTime') })}</p>}
      {request.status !== 'REJECTED' && (
        <p>
          {request.refundAmount
            ? t(refundPending ? 'refundPending' : 'refunded', { amount: money(request.refundAmount) })
            : t('noRefund')}
          {Number(request.feeAmount) > 0 && ` · ${t('feeKept', { amount: money(request.feeAmount) })}`}
        </p>
      )}
      {refundPending && (
        <p className="text-amber-700">
          {t('refundPendingHint')}{' '}
          <Link href={`/admin/orders?q=${encodeURIComponent(request.order.orderNumber)}`} className="underline" dir="ltr">
            {request.order.orderNumber}
          </Link>
        </p>
      )}
      {request.adminNote && <p className="whitespace-pre-line">{t('noteLabel', { note: request.adminNote })}</p>}
    </div>
  );
}
