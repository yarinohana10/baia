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
  selfCancelDeadline: null,
  canRequest: false,
  requiresReturn: false,
  windowHours: 48,
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
  it('cancels instantly inside the window unless the shopper asked to talk first', () => {
    const both = found(info({ canSelfCancel: true, canRequest: true }));
    expect(cancelsInstantly({ found: both, instant: true })).toBe(true);
    expect(cancelsInstantly({ found: both, instant: false })).toBe(false);
    expect(cancelsInstantly({ found: found(info({ canSelfCancel: true })), instant: false })).toBe(true);
    expect(cancelsInstantly({ found: null, instant: true })).toBe(false);
  });
});

describe('nextAfterLookup', () => {
  it('chooses, refuses or files a request', () => {
    expect(nextAfterLookup(info({ canSelfCancel: true }))).toBe('choose');
    expect(nextAfterLookup(info({ openRequest: { id: 'r', status: 'REQUESTED', reason: 'OTHER', createdAt: '' } }))).toBe('alreadyRequested');
    expect(nextAfterLookup(info())).toBe('notAllowed');
    expect(nextAfterLookup(undefined)).toBe('notAllowed');
    expect(nextAfterLookup(info({ canRequest: true }))).toBe('request');
  });
});
