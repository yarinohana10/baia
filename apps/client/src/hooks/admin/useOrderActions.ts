'use client';

import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import { orderErrorMessage } from '@/components/admin/orders/order-errors';
import type { AdminOrder, ResendTemplate } from '@/components/admin/orders/types';
import {
  buildCancelBody,
  buildCompleteBody,
  cancelOutcome,
  resendOutcome,
  type CancelResult,
  type ResendResult,
} from './order-actions';

type Options = {
  /** The page's banner; a success never replaces an error that is already shown. */
  setNotice: Dispatch<SetStateAction<Notice | null>>;
  /** Called after an order changed on the server (reloads the list). */
  onChanged: () => void;
};

/**
 * The admin's order actions (status change, cancel, settle a refund, resend an
 * email). Each resolves to an error message to show in place, or null on success;
 * successes are announced in the page banner.
 */
export function useOrderActions({ setNotice, onChanged }: Options) {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.orderCards');
  const te = useTranslations('admin.orderEmails');

  const announce = useCallback(
    (text: string) => setNotice((current) => (current?.kind === 'error' ? current : { kind: 'success', text })),
    [setNotice],
  );

  const changeStatus = useCallback(
    async (order: AdminOrder, status: string, trackingNumber: string): Promise<string | null> => {
      try {
        await api.put(`/admin/orders/${order.id}/status`, { status, trackingNumber });
        announce(`${t('updated')}: ${order.orderNumber}`);
        onChanged();
        return null;
      } catch (err) {
        return orderErrorMessage(err, t('updateFailed'), t);
      }
    },
    [announce, onChanged, t],
  );

  const cancelOrder = useCallback(
    async (order: AdminOrder, input: { refund: boolean; fee: number; note: string }): Promise<string | null> => {
      try {
        const res = await api.post<CancelResult | undefined>(
          `/admin/orders/${order.id}/cancel`,
          buildCancelBody(input),
        );
        const outcome = cancelOutcome(input.refund, res.data);
        if (outcome === 'cancelledRefundPending') {
          setNotice({ kind: 'error', text: tc('outcome.cancelledRefundPending', { number: order.orderNumber }) });
        } else {
          announce(tc(`outcome.${outcome}`, { number: order.orderNumber }));
        }
        onChanged();
        return null;
      } catch (err) {
        return orderErrorMessage(err, t('updateFailed'), t);
      }
    },
    [announce, onChanged, setNotice, t, tc],
  );

  const completeRefund = useCallback(
    async (refundId: string, orderNumber: string, input: { providerRef: string; note: string }): Promise<string | null> => {
      try {
        await api.post(`/admin/refunds/${refundId}/complete`, buildCompleteBody(input));
        announce(tc('refund.completed', { number: orderNumber }));
        onChanged();
        return null;
      } catch (err) {
        return isAxiosError(err) && err.response?.status === 409 ? tc('refund.alreadySettled') : tc('refund.actionFailed');
      }
    },
    [announce, onChanged, tc],
  );

  const failRefund = useCallback(
    async (refundId: string, orderNumber: string, note: string): Promise<string | null> => {
      try {
        await api.post(`/admin/refunds/${refundId}/fail`, note.trim() ? { note: note.trim() } : {});
        announce(tc('refund.markedFailed', { number: orderNumber }));
        onChanged();
        return null;
      } catch (err) {
        return isAxiosError(err) && err.response?.status === 409 ? tc('refund.alreadySettled') : tc('refund.actionFailed');
      }
    },
    [announce, onChanged, tc],
  );

  const resendEmail = useCallback(
    async (order: AdminOrder, template: ResendTemplate) => {
      const name = te(`templates.${template}`);
      let result: ResendResult | null = null;
      let failure: unknown;
      try {
        result = (await api.post<ResendResult>(`/admin/orders/${order.id}/resend-email`, { template })).data;
      } catch (err) {
        failure = err;
      }
      const outcome = resendOutcome(result, failure);
      const values = { name, email: order.customerEmail };
      if (outcome === 'sent') announce(tc('resend.sent', values));
      else setNotice({ kind: 'error', text: tc(`resend.${outcome}`, values) });
    },
    [announce, setNotice, tc, te],
  );

  return useMemo(
    () => ({ changeStatus, cancelOrder, completeRefund, failRefund, resendEmail }),
    [changeStatus, cancelOrder, completeRefund, failRefund, resendEmail],
  );
}

export type OrderActions = ReturnType<typeof useOrderActions>;
