'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { paymentSummary, type OrderPaymentFields } from '@/lib/payment';
import { formatShekels } from '@/components/admin/order-status';

type Attempt = {
  id: string;
  provider: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  amount: string;
  currency: string;
  providerRef: string | null;
  error: string | null;
  createdAt: string;
};

type OrderPayments = OrderPaymentFields & {
  id: string;
  paymentRef: string | null;
  paidAt: string | null;
  attempts: Attempt[];
};

const ATTEMPT_COLORS: Record<Attempt['status'], string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  SUCCEEDED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-destructive',
};

/**
 * Admin order panel section: how the order was paid and every charge attempt
 * (GET /admin/orders/:id/payments). Self-contained so the orders page only
 * renders it. `refreshKey` reloads it (e.g. after a status change).
 */
export function OrderPaymentPanel({ orderId, refreshKey }: { orderId: string; refreshKey?: string }) {
  const t = useTranslations('payment');
  const locale = useLocale();
  const [data, setData] = useState<{ orderId: string; payments: OrderPayments } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OrderPayments>(`/admin/orders/${encodeURIComponent(orderId)}/payments`)
      .then((res) => {
        if (cancelled) return;
        setData({ orderId, payments: res.data });
        setFailedFor(null);
      })
      .catch(() => !cancelled && setFailedFor(orderId));
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  const dateTimeFormat = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
  const payments = data?.orderId === orderId ? data.payments : null;
  const summary = payments ? paymentSummary(payments) : null;
  const errorLabel = (code: string) => (t.has(`admin.error.${code}`) ? t(`admin.error.${code}`) : code);

  return (
    <div className="border-t border-border pt-3 space-y-2 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <CreditCard size={14} className="text-ocean-700" aria-hidden="true" /> {t('admin.title')}
      </p>
      {failedFor === orderId && !payments ? (
        <p className="text-xs text-destructive">{t('admin.loadFailed')}</p>
      ) : !payments ? (
        <div className="h-10 rounded-lg bg-muted/60 animate-pulse" aria-busy="true" />
      ) : (
        <>
          <p>
            <span className="text-muted-foreground">{t('admin.method')}:</span>{' '}
            {summary ? t(`summary.${summary.key}`, summary.values) : t('admin.notRecorded')}
          </p>
          {payments.attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('admin.noAttempts')}</p>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('admin.attempts')}</p>
              <ul className="space-y-1">
                {payments.attempts.map((a) => (
                  <li key={a.id} className="rounded-lg bg-muted/60 px-3 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn('rounded-full px-2 py-0.5 font-medium', ATTEMPT_COLORS[a.status])}>
                      {t(`admin.status.${a.status}`)}
                    </span>
                    <span>{dateTimeFormat.format(new Date(a.createdAt))}</span>
                    <span>{formatShekels(a.amount)}</span>
                    <span className="text-muted-foreground">{a.provider}</span>
                    {a.error && <span className="text-destructive">{errorLabel(a.error)}</span>}
                    {a.providerRef && (
                      <span className="font-mono text-muted-foreground break-all" dir="ltr" title={t('admin.reference')}>
                        {a.providerRef}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
