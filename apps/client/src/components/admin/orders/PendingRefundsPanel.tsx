'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatAdminDate } from '@/lib/admin/format';
import { formatShekels as money } from '@/components/admin/order-status';
import type { OrderActions } from '@/hooks/admin/useOrderActions';
import { RefundCompleteDialog } from './RefundCompleteDialog';
import type { AdminRefundRow } from './types';

/** The Refund Pending queue, oldest first: refund in the provider's dashboard, then confirm here. */
export function PendingRefundsPanel({
  refunds,
  actions,
  onShowOrder,
}: {
  refunds: AdminRefundRow[];
  actions: OrderActions;
  /** Filters the cards to that order. */
  onShowOrder: (orderNumber: string) => void;
}) {
  const t = useTranslations('admin.orderCards.queue');
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = refunds.find((r) => r.id === selectedId) ?? null;

  return (
    <Card className="mb-6 border-amber-200">
      <CardContent className="space-y-3">
        <h2 className="text-sm font-medium">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onShowOrder(refund.order.orderNumber)}
                    className="font-mono font-semibold hover:text-ocean-700 hover:underline"
                    dir="ltr"
                  >
                    {refund.order.orderNumber}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {refund.order.recipientName ?? refund.order.customerEmail} ·{' '}
                    {formatAdminDate(refund.requestedAt, locale, 'shortTime')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{money(refund.amount)}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(refund.id)} className="gap-1.5">
                    <Banknote size={14} aria-hidden="true" /> {t('complete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {selected && (
        <RefundCompleteDialog
          orderNumber={selected.order.orderNumber}
          amount={selected.amount}
          canFail={selected.status === 'PENDING'}
          onComplete={(input) => actions.completeRefund(selected.id, selected.order.orderNumber, input)}
          onFail={(note) => actions.failRefund(selected.id, selected.order.orderNumber, note)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Card>
  );
}
