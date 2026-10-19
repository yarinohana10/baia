'use client';

import { useCallback, useMemo, useReducer, useRef, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import { formatShekels } from '@/components/admin/order-status';
import { orderErrorMessage } from '@/components/admin/orders/order-errors';
import { isPaidStatus } from '@/components/admin/orders/order-utils';
import { RESTOCK_STATUSES, type AdminOrder } from '@/components/admin/orders/types';
import { initialOrderDetail, isStatusChanging, orderDetailReducer } from './order-detail';

type OrdersT = ReturnType<typeof useTranslations<'admin.orders'>>;
type OrdersExtraT = ReturnType<typeof useTranslations<'admin.ordersExtra'>>;

/** The question asked before a status change that returns stock to inventory. */
function restockQuestion(order: AdminOrder, newStatus: string, refund: boolean, t: OrdersT, tx: OrdersExtraT) {
  if (newStatus !== 'CANCELLED') return t('confirmRefund');
  return refund ? tx('confirmCancelRefund', { amount: formatShekels(order.total) }) : t('confirmCancel');
}

/**
 * The admin order dialog: loads an order (GET /admin/orders/:id), edits its
 * status / tracking number and saves it — POST /admin/orders/:id/cancel for
 * cancellations (optionally refunding), PUT /admin/orders/:id/status otherwise.
 * Focus returns to the element that opened the dialog when it closes.
 */
export function useOrderDetail({
  setNotice,
  onUpdated,
}: {
  /** The page's banner; a success never replaces an error that is already shown. */
  setNotice: Dispatch<SetStateAction<Notice | null>>;
  /** Called after a successful update (e.g. to reload the list). */
  onUpdated: () => void;
}) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const [state, dispatch] = useReducer(orderDetailReducer, initialOrderDetail);
  const updatingRef = useRef(false);
  const loadingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);

  const closeDetail = useCallback(() => {
    dispatch({ type: 'closed' });
    returnFocusRef.current?.focus();
  }, []);

  const openDetail = useCallback(
    async (id: string, trigger: HTMLElement) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      returnFocusRef.current = trigger;
      try {
        const res = await api.get<AdminOrder>(`/admin/orders/${id}`);
        dispatch({ type: 'opened', order: res.data });
      } catch (err) {
        setNotice({ kind: 'error', text: orderErrorMessage(err, t('detailFailed'), t) });
      } finally {
        loadingRef.current = false;
      }
    },
    [setNotice, t],
  );

  const updateStatus = async () => {
    const { order, newStatus, trackingNumber, refundOnCancel } = state;
    if (!order || !newStatus || updatingRef.current) return;
    const changing = isStatusChanging(state);
    const refund = isPaidStatus(order.status) && refundOnCancel;
    if (changing && newStatus === 'SHIPPED' && !trackingNumber.trim()) {
      trackingInputRef.current?.focus();
      if (!confirm(tx('shipWithoutTracking'))) return;
    }
    if (changing && RESTOCK_STATUSES.includes(newStatus) && !confirm(restockQuestion(order, newStatus, refund, t, tx))) {
      return;
    }
    updatingRef.current = true;
    dispatch({ type: 'updateStarted' });
    try {
      if (changing && newStatus === 'CANCELLED') {
        // Cancels (restock), refunds through the payment provider when asked,
        // closes any open cancellation request and emails the customer.
        const res = await api.post<{ refundFailed?: boolean } | undefined>(`/admin/orders/${order.id}/cancel`, { refund });
        if (res.data?.refundFailed) {
          setNotice({ kind: 'error', text: tx('refundFailed', { number: order.orderNumber }) });
        }
      } else {
        await api.put(`/admin/orders/${order.id}/status`, { status: newStatus, trackingNumber });
      }
      dispatch({ type: 'updateSucceeded' });
      returnFocusRef.current?.focus();
      setNotice((current) =>
        current?.kind === 'error' ? current : { kind: 'success', text: `${t('updated')}: ${order.orderNumber}` },
      );
      onUpdated();
    } catch (err) {
      dispatch({ type: 'updateFailed', error: orderErrorMessage(err, t('updateFailed'), t) });
    } finally {
      updatingRef.current = false;
      dispatch({ type: 'updateSettled' });
    }
  };

  const fields = useMemo(
    () => ({
      setStatus: (status: string) => dispatch({ type: 'statusChanged', status }),
      setTrackingNumber: (trackingNumber: string) => dispatch({ type: 'trackingChanged', trackingNumber }),
      setRefundOnCancel: (refund: boolean) => dispatch({ type: 'refundChanged', refund }),
    }),
    [],
  );

  return { state, trackingInputRef, openDetail, closeDetail, updateStatus, ...fields };
}

export type OrderDetail = ReturnType<typeof useOrderDetail>;
