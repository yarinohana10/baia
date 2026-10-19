'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { OrderEmailsPanel } from '@/components/admin/OrderEmailsPanel';
import { OrderPaymentPanel } from '@/components/admin/OrderPaymentPanel';
import { OrderCancellationRequests } from './OrderCancellationRequests';
import { OrderItemsTotals } from './OrderItemsTotals';
import { OrderSummary } from './OrderSummary';
import { isPaidStatus } from './order-utils';
import type { AdminOrder } from './types';

/**
 * Modal with an order's details; `children` (the status form) go last.
 * Takes focus when it opens and closes on Escape or a click on the backdrop.
 */
export function OrderDetailDialog({
  order,
  onClose,
  children,
}: {
  order: AdminOrder;
  /** Must be stable (it is an effect dependency). */
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('admin.orders');
  const dialogRef = useRef<HTMLDivElement>(null);
  const requests = order.cancellationRequests ?? [];

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [order.id, onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-dialog-title"
        tabIndex={-1}
        className="max-w-lg w-full max-h-[80vh] overflow-y-auto outline-none"
      >
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle id="order-dialog-title" className="font-mono">
              {order.orderNumber}
            </CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              {t('close')}
            </Button>
          </div>

          <OrderSummary order={order} />
          <OrderItemsTotals order={order} />
          <OrderPaymentPanel orderId={order.id} refreshKey={order.status} />
          <OrderEmailsPanel
            orderId={order.id}
            customerEmail={order.customerEmail}
            canResend={!!order.paidAt && isPaidStatus(order.status)}
            refreshKey={order.status}
          />
          {requests.length > 0 && <OrderCancellationRequests requests={requests} />}
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
