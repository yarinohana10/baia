'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Banknote, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrderActions } from '@/hooks/admin/useOrderActions';
import { CancelOrderDialog } from './CancelOrderDialog';
import { RefundCompleteDialog } from './RefundCompleteDialog';
import { ResendEmailMenu } from './ResendEmailMenu';
import { canCancelOrder, canFailRefund, type RefundState } from './order-utils';
import type { AdminOrder } from './types';

type Dialog = 'cancel' | 'refund' | null;

/** Details, cancel (with refund), settle a Refund Pending and resend an email. */
export function OrderCardActions({
  order,
  refund,
  actions,
  onDetails,
}: {
  order: AdminOrder;
  refund: RefundState | null;
  actions: OrderActions;
  onDetails: (id: string) => void;
}) {
  const t = useTranslations('admin.orderCards');
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = () => setDialog(null);
  const pendingRefund = refund?.kind === 'pending' ? refund.refund : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {pendingRefund && (
          <Button
            type="button"
            size="sm"
            onClick={() => setDialog('refund')}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
          >
            <Banknote size={14} aria-hidden="true" /> {t('refund.complete')}
          </Button>
        )}
        {canCancelOrder(order) && (
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog('cancel')} className="gap-1.5">
            <Ban size={14} aria-hidden="true" /> {t('cancel.open')}
          </Button>
        )}
        <ResendEmailMenu order={order} onResend={(template) => actions.resendEmail(order, template)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => onDetails(order.id)} className="gap-1.5">
          <Eye size={14} aria-hidden="true" /> {t('details')}
        </Button>
      </div>

      {dialog === 'cancel' && (
        <CancelOrderDialog order={order} onCancel={(input) => actions.cancelOrder(order, input)} onClose={closeDialog} />
      )}
      {dialog === 'refund' && pendingRefund && (
        <RefundCompleteDialog
          orderNumber={order.orderNumber}
          amount={pendingRefund.amount}
          canFail={canFailRefund(refund)}
          onComplete={(input) => actions.completeRefund(pendingRefund.id, order.orderNumber, input)}
          onFail={(note) => actions.failRefund(pendingRefund.id, order.orderNumber, note)}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
