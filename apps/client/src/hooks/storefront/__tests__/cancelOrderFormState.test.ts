import { describe, expect, it } from 'vitest';
import type { CancellationInfo, CustomerOrder } from '@/lib/orders';
import {
  cancelOrderFormReducer,
  cancelsInstantly,
  initialCancelOrderForm,
  nextAfterLookup,
  type FoundOrder,
} from '../cancelOrderFormState';

const info = (overrides: Partial<CancellationInfo> = {}): CancellationInfo => ({
  canSelfCancel: false,
  canRequest: false,
  requiresReturn: false,
  openRequest: null,
  ...overrides,
});

const found = (cancellation: CancellationInfo): FoundOrder => ({
  order: { id: 'o1', status: 'CONFIRMED', cancellation } as CustomerOrder,
  accessToken: 't',
});

describe('cancelOrderFormReducer', () => {
  it('edits a field and clears its schema issue (phone → contactPhone)', () => {
    const state = { ...initialCancelOrderForm, issues: { contactPhone: { key: 'validation.phone' } } };
    const next = cancelOrderFormReducer(state, { type: 'edit', field: 'phone', value: '050' });
    expect(next.fields.phone).toBe('050');
    expect(next.issues).toEqual({});
  });

  it('starting over forgets the found order and the error, keeping the fields', () => {
    const state = {
      ...initialCancelOrderForm,
      fields: { ...initialCancelOrderForm.fields, orderNumber: 'BA-1' },
      found: found(info({ canSelfCancel: true })),
      error: { key: 'generic' },
    };
    expect(cancelOrderFormReducer(state, { type: 'startOver' })).toMatchObject({ found: null, error: null, fields: { orderNumber: 'BA-1' } });
  });
});

describe('cancelsInstantly', () => {
  it('cancels instantly exactly while the order has not shipped', () => {
    expect(cancelsInstantly({ found: found(info({ canSelfCancel: true })) })).toBe(true);
    expect(cancelsInstantly({ found: found(info({ canRequest: true, requiresReturn: true })) })).toBe(false);
    expect(cancelsInstantly({ found: null })).toBe(false);
  });
});

describe('nextAfterLookup', () => {
  it('confirms an instant cancel, refuses, or files a request for a shipped order', () => {
    expect(nextAfterLookup(info({ canSelfCancel: true }))).toBe('confirm');
    expect(nextAfterLookup(info({ openRequest: { id: 'r', status: 'REQUESTED', reason: 'OTHER', createdAt: '' } }))).toBe('alreadyRequested');
    expect(nextAfterLookup(info())).toBe('notAllowed');
    expect(nextAfterLookup(undefined)).toBe('notAllowed');
    expect(nextAfterLookup(info({ canRequest: true }))).toBe('request');
  });
});
