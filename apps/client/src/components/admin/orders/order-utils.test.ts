import { describe, expect, it } from 'vitest';
import { canCancelOrder, canFailRefund, canResendTemplate, refundState, statusEventActor } from './order-utils';
import type { AdminOrder, OrderRefund } from './types';

const refund = (over: Partial<OrderRefund>): OrderRefund => ({
  id: 'r1',
  orderId: 'o1',
  amount: '120.00',
  status: 'PENDING',
  requestedAt: '2026-10-20T10:00:00.000Z',
  ...over,
});

describe('refundState', () => {
  it('is Refund Pending for a cancelled order with an unsettled refund', () => {
    expect(refundState({ status: 'CANCELLED', refunds: [refund({})] })?.kind).toBe('pending');
    expect(refundState({ status: 'CANCELLED', refunds: [refund({ status: 'FAILED' })] })?.kind).toBe('pending');
  });

  it('is Refunded once a refund is COMPLETED', () => {
    const state = refundState({ status: 'REFUNDED', refunds: [refund({ status: 'COMPLETED' })] });
    expect(state?.kind).toBe('completed');
    expect(state?.refund.amount).toBe('120.00');
  });

  it('prefers the completed refund over older rows', () => {
    const rows = [refund({ id: 'a', status: 'FAILED' }), refund({ id: 'b', status: 'COMPLETED' })];
    expect(refundState({ status: 'REFUNDED', refunds: rows })?.refund.id).toBe('b');
  });

  it('has no state without a refund or when the order is not cancelled', () => {
    expect(refundState({ status: 'CANCELLED', refunds: [] })).toBeNull();
    expect(refundState({ status: 'CANCELLED' })).toBeNull();
    expect(refundState({ status: 'CONFIRMED', refunds: [refund({})] })).toBeNull();
  });

  it('only a PENDING refund can be marked as failed', () => {
    expect(canFailRefund(refundState({ status: 'CANCELLED', refunds: [refund({})] }))).toBe(true);
    expect(canFailRefund(refundState({ status: 'CANCELLED', refunds: [refund({ status: 'FAILED' })] }))).toBe(false);
    expect(canFailRefund(null)).toBe(false);
  });
});

describe('statusEventActor', () => {
  const event = { id: 'e', fromStatus: 'CONFIRMED', toStatus: 'SHIPPED', createdAt: '2026-10-20T10:00:00.000Z' };
  it('is the admin email, or null for the system', () => {
    expect(statusEventActor({ ...event, changedByEmail: 'a@baia.co.il' })).toBe('a@baia.co.il');
    expect(statusEventActor({ ...event, changedByEmail: null })).toBeNull();
    expect(statusEventActor({ ...event, changedByEmail: '  ' })).toBeNull();
  });
});

describe('canCancelOrder', () => {
  it('follows the allowed transitions', () => {
    expect(canCancelOrder({ allowedTransitions: ['SHIPPED', 'CANCELLED'] })).toBe(true);
    expect(canCancelOrder({ allowedTransitions: ['REFUNDED'] })).toBe(false);
    expect(canCancelOrder({})).toBe(false);
  });
});

describe('canResendTemplate', () => {
  const base = {
    status: 'CONFIRMED',
    paidAt: '2026-10-20T10:00:00.000Z',
    shippedAt: null,
    deliveredAt: null,
    refunds: [],
  } as unknown as AdminOrder;

  it('offers only the emails the order has reached', () => {
    expect(canResendTemplate(base, 'order-confirmation')).toBe(true);
    expect(canResendTemplate(base, 'admin-new-order')).toBe(true);
    expect(canResendTemplate(base, 'order-processing')).toBe(false);
    expect(canResendTemplate(base, 'order-shipped')).toBe(false);
    expect(canResendTemplate(base, 'order-delivered')).toBe(false);
    expect(canResendTemplate(base, 'order-cancelled')).toBe(false);
    expect(canResendTemplate(base, 'refund-completed')).toBe(false);
  });

  it('opens shipping, delivery, cancellation and refund emails as the order progresses', () => {
    const shipped = { ...base, status: 'SHIPPED', shippedAt: '2026-10-21T10:00:00.000Z' };
    expect(canResendTemplate(shipped, 'order-processing')).toBe(true);
    expect(canResendTemplate(shipped, 'order-shipped')).toBe(true);
    const refunded = { ...base, status: 'REFUNDED', refunds: [refund({ status: 'COMPLETED' })] };
    expect(canResendTemplate(refunded, 'order-cancelled')).toBe(true);
    expect(canResendTemplate(refunded, 'refund-completed')).toBe(true);
    expect(canResendTemplate(refunded, 'order-confirmation')).toBe(true);
  });

  it('never offers the confirmation of an unpaid order', () => {
    expect(canResendTemplate({ ...base, status: 'PENDING_PAYMENT', paidAt: null }, 'order-confirmation')).toBe(false);
  });
});
