import { isAxiosError } from 'axios';
import { errorCode, shopErrorMessage } from '@/lib/shop-errors';
import type { DeclineCode, PaymentMethod } from '@/lib/payment';

/** An error under `payment.errors.*` or `checkout.errors.*`; `kept` adds "your order is saved". */
export type PayError = { ns: 'payment' | 'checkout'; key: string; values?: Record<string, string | number>; kept?: boolean };

export type PaymentState = {
  method: PaymentMethod;
  paying: boolean;
  succeeded: boolean;
  error: PayError | null;
  /** Bumped after a decline so the card form starts clean for another card. */
  attempt: number;
};

export type PaymentAction =
  /** Clicked tab: also clears the last error. */
  | { type: 'selectMethod'; method: PaymentMethod }
  /** Arrow-key move between tabs. */
  | { type: 'moveToMethod'; method: PaymentMethod }
  | { type: 'start' }
  | { type: 'succeeded' }
  | { type: 'failed'; error: PayError; declined: boolean };

export const initialPaymentState: PaymentState = {
  method: 'card',
  paying: false,
  succeeded: false,
  error: null,
  attempt: 0,
};

export function paymentReducer(state: PaymentState, action: PaymentAction): PaymentState {
  switch (action.type) {
    case 'selectMethod':
      return { ...state, method: action.method, error: null };
    case 'moveToMethod':
      return { ...state, method: action.method };
    case 'start':
      return { ...state, paying: true, error: null };
    case 'succeeded':
      // Stays "paying" while the confirmation page loads.
      return { ...state, succeeded: true };
    case 'failed':
      return {
        ...state,
        paying: false,
        error: action.error,
        attempt: action.declined ? state.attempt + 1 : state.attempt,
      };
  }
}

const DECLINE_CODES: DeclineCode[] = ['card_declined', 'insufficient_funds', 'provider_error', 'declined'];

/** Why POST /orders/:id/pay failed, as the message to show (and whether the order is no longer payable). */
export function payFailure(err: unknown, locale: string): { error: PayError; declined: boolean; notPayable: boolean } {
  const status = isAxiosError(err) ? err.response?.status : undefined;
  if (status === 402) {
    const code = (isAxiosError(err) ? err.response?.data?.declineCode : undefined) as DeclineCode | undefined;
    const key = code && DECLINE_CODES.includes(code) ? code : 'declined';
    return { error: { ns: 'payment', key, kept: true }, declined: true, notPayable: false };
  }
  if (errorCode(err) === 'ORDER_NOT_PAYABLE') {
    return { error: { ns: 'checkout', key: 'orderNotPayable' }, declined: false, notPayable: true };
  }
  if (status === 409) return { error: { ns: 'payment', key: 'inProgress' }, declined: false, notPayable: false };
  const message = shopErrorMessage(err, locale);
  return { error: { ns: 'checkout', key: message.key, values: message.values }, declined: false, notPayable: false };
}
