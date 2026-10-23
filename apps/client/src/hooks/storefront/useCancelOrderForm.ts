'use client';

import { useReducer } from 'react';
import { useLocale } from 'next-intl';
import { publicCancellationSchema, type PublicCancellationPayload } from '@baia/shared';
import { api } from '@/lib/api';
import { validateForm } from '@/lib/form-errors';
import { shopErrorMessage } from '@/lib/shop-errors';
import { useBusyAction } from './useBusyAction';
import {
  cancelOrderFormReducer,
  initialCancelOrderForm,
  nextAfterLookup,
  type CancellationResult,
  type FoundOrder,
} from './cancelOrderFormState';

const LOOKUP_ERRORS = {
  alreadyRequested: { key: 'cancellationAlreadyRequested' },
  notAllowed: { key: 'cancellationNotAllowed' },
} as const;

async function sendCancellation(payload: PublicCancellationPayload): Promise<CancellationResult> {
  const res = await api.post<CancellationResult>('/cancellations', payload);
  return res.data;
}

/**
 * Public cancellation flow. Step 1 checks the order (number + email); an order
 * that has not shipped is then cancelled once the shopper confirms, a shipped
 * one gets a request filed right away. Both go through POST /cancellations.
 */
export function useCancelOrderForm() {
  const locale = useLocale();
  const [state, dispatch] = useReducer(cancelOrderFormReducer, initialCancelOrderForm);
  const [submitting, run] = useBusyAction();

  /** Step 1: look the order up; files the request directly when there is nothing to choose. */
  const lookUp = async (payload: PublicCancellationPayload) => {
    const res = await api.post<FoundOrder>('/orders/lookup', { orderNumber: payload.orderNumber, email: payload.email });
    const next = nextAfterLookup(res.data.order.cancellation);
    if (next === 'confirm') dispatch({ type: 'found', found: res.data });
    else if (next === 'request') dispatch({ type: 'completed', result: await sendCancellation(payload) });
    else dispatch({ type: 'failed', error: LOOKUP_ERRORS[next] });
  };

  const submit = async () => {
    const { fields, found } = state;
    if (submitting || !fields.reason) return;
    const check = validateForm(publicCancellationSchema, {
      orderNumber: fields.orderNumber,
      email: fields.email,
      reason: fields.reason,
      details: fields.details,
      contactPhone: fields.phone,
    });
    dispatch({ type: 'validated', issues: check.errors });
    if (!check.success) return;
    dispatch({ type: 'submitting' });
    await run(async () => {
      try {
        if (found) dispatch({ type: 'completed', result: await sendCancellation(check.data) });
        else await lookUp(check.data);
      } catch (err) {
        dispatch({ type: 'failed', error: shopErrorMessage(err, locale) });
      }
      return 'done';
    });
  };

  return { state, dispatch, submitting, submit };
}
