import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  buildCancelBody,
  buildCompleteBody,
  cancelOutcome,
  parseCancelFee,
  resendOutcome,
} from './order-actions';

describe('parseCancelFee', () => {
  it('treats an empty fee as none and rounds to agorot', () => {
    expect(parseCancelFee('', 100)).toBe(0);
    expect(parseCancelFee('5.456', 100)).toBe(5.46);
  });
  it('rejects negative, too large and non-numeric fees', () => {
    expect(parseCancelFee('-1', 100)).toBeNull();
    expect(parseCancelFee('100.01', 100)).toBeNull();
    expect(parseCancelFee('abc', 100)).toBeNull();
  });
});

describe('buildCancelBody', () => {
  it('sends the fee only when refunding, and drops an empty note', () => {
    expect(buildCancelBody({ refund: true, fee: 5, note: ' ' })).toEqual({ refund: true, feeAmount: 5 });
    expect(buildCancelBody({ refund: false, fee: 5, note: 'x' })).toEqual({ refund: false, adminNote: 'x' });
    expect(buildCancelBody({ refund: true, fee: 0, note: '' })).toEqual({ refund: true });
  });
});

describe('cancelOutcome', () => {
  it('reports a pending refund before anything else', () => {
    expect(cancelOutcome(true, { refundAmount: '100', refundPending: true })).toBe('cancelledRefundPending');
  });
  it('reports a refund only when one was made', () => {
    expect(cancelOutcome(true, { refundAmount: '100', refundPending: false })).toBe('cancelledRefunded');
    expect(cancelOutcome(false, { refundAmount: null, refundPending: false })).toBe('cancelled');
    expect(cancelOutcome(false, undefined)).toBe('cancelled');
  });
});

describe('buildCompleteBody', () => {
  it('leaves blank fields out and trims the rest', () => {
    expect(buildCompleteBody({ providerRef: '', note: '' })).toEqual({});
    expect(buildCompleteBody({ providerRef: ' re_1 ', note: 'done' })).toEqual({ providerRef: 're_1', note: 'done' });
  });
});

describe('resendOutcome', () => {
  const conflict = new AxiosError('conflict', '409', undefined, undefined, { status: 409 } as never);
  it('maps the response and a 409 to friendly outcomes', () => {
    expect(resendOutcome({ status: 'SENT' })).toBe('sent');
    expect(resendOutcome({ status: 'FAILED', error: 'x' })).toBe('failed');
    expect(resendOutcome(null, conflict)).toBe('notReached');
    expect(resendOutcome(null, new Error('network'))).toBe('error');
  });
});
