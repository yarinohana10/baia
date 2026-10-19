import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { initialPaymentState, payFailure, paymentReducer } from '../paymentState';

function apiError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse);
}

describe('paymentReducer', () => {
  it('clicking a tab clears the error; arrow keys keep it', () => {
    const state = { ...initialPaymentState, error: { ns: 'payment' as const, key: 'declined' } };
    expect(paymentReducer(state, { type: 'selectMethod', method: 'bit' })).toMatchObject({ method: 'bit', error: null });
    expect(paymentReducer(state, { type: 'moveToMethod', method: 'bit' })).toMatchObject({ method: 'bit', error: state.error });
  });

  it('stays busy after success and resets the card form only after a decline', () => {
    const paying = paymentReducer(initialPaymentState, { type: 'start' });
    expect(paying.paying).toBe(true);
    expect(paymentReducer(paying, { type: 'succeeded' })).toMatchObject({ paying: true, succeeded: true });
    const declined = paymentReducer(paying, { type: 'failed', error: { ns: 'payment', key: 'card_declined' }, declined: true });
    expect(declined).toMatchObject({ paying: false, attempt: 1 });
    expect(paymentReducer(paying, { type: 'failed', error: { ns: 'checkout', key: 'generic' }, declined: false }).attempt).toBe(0);
  });
});

describe('payFailure', () => {
  it('maps declines to their code, keeping the order', () => {
    expect(payFailure(apiError(402, { declineCode: 'insufficient_funds' }), 'he')).toEqual({
      error: { ns: 'payment', key: 'insufficient_funds', kept: true },
      declined: true,
      notPayable: false,
    });
    expect(payFailure(apiError(402, { declineCode: 'weird' }), 'he').error.key).toBe('declined');
  });

  it('flags orders that are no longer payable, and payments in progress', () => {
    expect(payFailure(apiError(400, { code: 'ORDER_NOT_PAYABLE' }), 'he')).toMatchObject({
      error: { ns: 'checkout', key: 'orderNotPayable' },
      notPayable: true,
    });
    expect(payFailure(apiError(409, {}), 'he').error).toEqual({ ns: 'payment', key: 'inProgress' });
  });

  it('falls back to the shop error message', () => {
    expect(payFailure(new Error('offline'), 'he').error).toEqual({ ns: 'checkout', key: 'generic', values: undefined });
  });
});
