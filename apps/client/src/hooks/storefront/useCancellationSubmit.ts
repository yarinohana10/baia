'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import type { CancellationReason, CustomerOrder } from '@/lib/orders';
import { useBusyAction } from './useBusyAction';

/** Instant free cancel, or a request the store reviews. */
export type CancellationMode = 'cancel' | 'request';

export type CancellationFields = { reason: CancellationReason; details: string; phone: string };

/** POST /orders/:id/cancel or /cancellation-request; resolves to the server's fresh order. */
export async function sendCancellation(
  orderId: string,
  mode: CancellationMode,
  { reason, details, phone }: CancellationFields,
  token?: string | null,
): Promise<CustomerOrder> {
  const config = { headers: token ? { 'X-Order-Token': token } : undefined };
  const id = encodeURIComponent(orderId);
  const res =
    mode === 'cancel'
      ? await api.post<CustomerOrder>(`/orders/${id}/cancel`, { reason, details: details || undefined }, config)
      : await api.post<CustomerOrder>(
          `/orders/${id}/cancellation-request`,
          { reason, details: details || undefined, contactPhone: phone.trim() },
          config,
        );
  return res.data;
}

/** Submission state for the cancellation dialog of an order the viewer owns. */
export function useCancellationSubmit({
  orderId,
  mode,
  token,
  onDone,
}: {
  orderId: string;
  mode: CancellationMode;
  token?: string | null;
  onDone: (order: CustomerOrder) => void;
}) {
  const locale = useLocale();
  const [submitting, run] = useBusyAction();
  const [error, setError] = useState<ErrorMessage | null>(null);

  const submit = (fields: CancellationFields) =>
    run(async () => {
      setError(null);
      try {
        onDone(await sendCancellation(orderId, mode, fields, token));
      } catch (err) {
        setError(shopErrorMessage(err, locale));
      }
      return 'done';
    });

  return { submitting, error, submit };
}
