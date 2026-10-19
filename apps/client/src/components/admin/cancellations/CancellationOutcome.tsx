'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatAdminDate } from '@/lib/admin/format';
import { formatShekels as money } from '@/components/admin/order-status';
import type { AdminCancellation } from './types';

/** How a closed request was resolved: when, refund and fee, and the admin's note. */
export function CancellationOutcome({ request }: { request: AdminCancellation }) {
  const t = useTranslations('admin.cancellations');
  const locale = useLocale();
  return (
    <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
      {request.resolvedAt && <p>{t('resolvedAt', { date: formatAdminDate(request.resolvedAt, locale, 'shortTime') })}</p>}
      {request.status !== 'REJECTED' && (
        <p>
          {request.refundAmount ? t('refunded', { amount: money(request.refundAmount) }) : t('noRefund')}
          {Number(request.feeAmount) > 0 && ` · ${t('feeKept', { amount: money(request.feeAmount) })}`}
        </p>
      )}
      {request.adminNote && <p className="whitespace-pre-line">{t('noteLabel', { note: request.adminNote })}</p>}
    </div>
  );
}
