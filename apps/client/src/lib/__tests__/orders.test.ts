import { describe, expect, it } from 'vitest';
import { formatEta, freeShippingProgress, isClosed, orderPageHref, pendingRefund, statusLabelKey, stepDate, timelineIndex } from '../orders';
import { etaFor, shippingFor } from '@/store/cart';

describe('order timeline', () => {
  it('maps statuses to the last reached step', () => {
    expect(timelineIndex('PENDING_PAYMENT')).toBe(0);
    expect(timelineIndex('CONFIRMED')).toBe(1);
    expect(timelineIndex('PROCESSING')).toBe(2);
    expect(timelineIndex('SHIPPED')).toBe(3);
    expect(timelineIndex('DELIVERED')).toBe(4);
    expect(timelineIndex('CANCELLED')).toBe(-1);
    expect(isClosed('REFUNDED')).toBe(true);
    expect(isClosed('SHIPPED')).toBe(false);
  });

  it('dates the steps we record', () => {
    const order = { createdAt: 'a', paidAt: 'b', shippedAt: null };
    expect(stepDate(order, 'received')).toBe('a');
    expect(stepDate(order, 'paid')).toBe('b');
    expect(stepDate(order, 'shipped')).toBeNull();
    expect(stepDate(order, 'processing')).toBeNull();
    expect(stepDate(order, 'delivered')).toBeNull();
  });

  it('dates in-progress and delivered from the history and stamps', () => {
    const order = {
      createdAt: 'a',
      paidAt: 'b',
      shippedAt: 'd',
      deliveredAt: 'e',
      statusEvents: [
        { toStatus: 'PENDING_PAYMENT' as const, createdAt: 'a' },
        { toStatus: 'PROCESSING' as const, createdAt: 'c' },
      ],
    };
    expect(stepDate(order, 'processing')).toBe('c');
    expect(stepDate(order, 'delivered')).toBe('e');
  });
});

describe('refund state', () => {
  const refund = (status: 'PENDING' | 'COMPLETED' | 'FAILED') => ({ id: 'r', status, amount: '10', requestedAt: 'x', completedAt: null });

  it('a cancelled order with an unsettled refund shows as Refund Pending', () => {
    expect(statusLabelKey({ status: 'CANCELLED', refunds: [refund('PENDING')] })).toBe('REFUND_PENDING');
    expect(statusLabelKey({ status: 'CANCELLED', refunds: [refund('FAILED')] })).toBe('REFUND_PENDING');
    expect(statusLabelKey({ status: 'CANCELLED', refunds: [refund('COMPLETED')] })).toBe('CANCELLED');
    expect(statusLabelKey({ status: 'CANCELLED' })).toBe('CANCELLED');
    expect(statusLabelKey({ status: 'REFUNDED', refunds: [refund('COMPLETED')] })).toBe('REFUNDED');
    expect(pendingRefund({ refunds: [refund('COMPLETED'), refund('PENDING')] })?.status).toBe('PENDING');
    expect(pendingRefund({})).toBeNull();
  });
});

describe('delivery helpers', () => {
  const config = { cost: 30, freeThreshold: 300, pickupCost: 15, courierEtaDays: '3-5', pickupEtaDays: '2-4' };

  it('prices each method, both free at the threshold', () => {
    expect(shippingFor(100, config)).toBe(30);
    expect(shippingFor(100, config, 'PICKUP_POINT')).toBe(15);
    expect(shippingFor(300, config, 'PICKUP_POINT')).toBe(0);
    expect(etaFor(config, 'PICKUP_POINT')).toBe('2-4');
    expect(formatEta('3-5')).toBe('3–5');
  });

  it('reports free-shipping progress', () => {
    expect(freeShippingProgress(200, 300)).toEqual({ remaining: 100, percent: 67, reached: false });
    expect(freeShippingProgress(350, 300)).toEqual({ remaining: 0, percent: 100, reached: true });
  });

  it('keeps guest tokens in the URL fragment', () => {
    expect(orderPageHref('o1', 'tok')).toBe('/order-confirmation/o1#token=tok');
    expect(orderPageHref('o1')).toBe('/order-confirmation/o1');
  });
});
