'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatAdminDate } from '@/lib/admin/format';
import { formatShekels as money } from '@/components/admin/order-status';
import type { OrderCancellationRequest } from './types';

/** The customer's cancellation requests for the order, with a link to handle an open one. */
export function OrderCancellationRequests({ requests }: { requests: OrderCancellationRequest[] }) {
  const tx = useTranslations('admin.ordersExtra');
  const tReasons = useTranslations('cancellation.reasons');
  const locale = useLocale();

  return (
    <div className="border-t border-border pt-3 space-y-2 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <Undo2 size={14} className="text-ocean-700" /> {tx('cancellationRequests')}
      </p>
      {requests.map((r) => (
        <div key={r.id} className="rounded-lg bg-muted/60 px-3 py-2 text-xs space-y-0.5">
          <p>
            <span className="font-medium">{tx(`requestStatus.${r.status}`)}</span> ·{' '}
            {tReasons.has(r.reason) ? tReasons(r.reason) : r.reason} · {formatAdminDate(r.createdAt, locale, 'shortTime')}
          </p>
          {r.refundAmount && <p>{tx('refundedAmount', { amount: money(r.refundAmount) })}</p>}
          {r.adminNote && <p className="text-muted-foreground">{r.adminNote}</p>}
        </div>
      ))}
      {requests.some((r) => r.status === 'REQUESTED') && (
        <Link href="/admin/cancellations" className="inline-block text-xs text-ocean-700 hover:underline">
          {tx('handleRequest')}
        </Link>
      )}
    </div>
  );
}
