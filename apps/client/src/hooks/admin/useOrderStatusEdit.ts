'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatShekels } from '@/components/admin/order-status';
import { isPaidStatus } from '@/components/admin/orders/order-utils';
import { RESTOCK_STATUSES, type AdminOrder } from '@/components/admin/orders/types';
import type { OrderActions } from './useOrderActions';
import { draftFromOrder, isStatusChanging, isUpdateUnchanged } from './order-status-edit';

/**
 * The status form of one order card: the picked status and tracking number, the
 * refund choice for cancelling, and saving. Mount it with a key that changes when
 * the saved order does (`draftKey`), so the form starts over from the new order.
 * Cancelling goes through POST /admin/orders/:id/cancel, other changes through
 * PUT /admin/orders/:id/status.
 */
export function useOrderStatusEdit(order: AdminOrder, actions: OrderActions) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const [draft, setDraft] = useState(() => draftFromOrder(order));
  const [refundOnCancel, setRefundOnCancel] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const changing = isStatusChanging(order, draft);
  const unchanged = isUpdateUnchanged(order, draft);

  const save = async () => {
    if (savingRef.current || unchanged) return;
    const refund = isPaidStatus(order.status) && refundOnCancel;
    if (changing && draft.status === 'SHIPPED' && !draft.trackingNumber.trim()) {
      trackingInputRef.current?.focus();
      if (!confirm(tx('shipWithoutTracking'))) return;
    }
    if (changing && RESTOCK_STATUSES.includes(draft.status)) {
      const question =
        draft.status !== 'CANCELLED'
          ? t('confirmRefund')
          : refund
            ? tx('confirmCancelRefund', { amount: formatShekels(order.total) })
            : t('confirmCancel');
      if (!confirm(question)) return;
    }
    savingRef.current = true;
    setUpdating(true);
    setError(null);
    const failure =
      changing && draft.status === 'CANCELLED'
        ? await actions.cancelOrder(order, { refund, fee: 0, note: '' })
        : await actions.changeStatus(order, draft.status, draft.trackingNumber);
    savingRef.current = false;
    setUpdating(false);
    setError(failure);
  };

  return {
    draft,
    changing,
    unchanged,
    refundOnCancel,
    updating,
    error,
    trackingInputRef,
    setStatus: (status: string) => setDraft((d) => ({ ...d, status })),
    setTrackingNumber: (trackingNumber: string) => setDraft((d) => ({ ...d, trackingNumber })),
    setRefundOnCancel,
    save,
  };
}

export type OrderStatusEdit = ReturnType<typeof useOrderStatusEdit>;
