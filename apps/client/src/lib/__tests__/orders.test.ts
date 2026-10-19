import { describe, expect, it } from 'vitest';
import { formatEta, freeShippingProgress, isClosed, orderPageHref, stepDate, timelineIndex } from '../orders';
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
