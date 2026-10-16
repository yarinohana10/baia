import { OrderStatus } from '../src/generated/prisma';
import { allowedTransitions, canTransition } from '../src/orders/order-status';
import { availableStock, hasStock } from '../src/common/stock';

describe('order status transitions', () => {
  it('lets an unpaid order only be confirmed or cancelled', () => {
    expect(allowedTransitions(OrderStatus.PENDING_PAYMENT).sort()).toEqual(['CANCELLED', 'CONFIRMED']);
  });

  it('lets fulfilment steps move both ways to correct mistakes', () => {
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.REFUNDED)).toBe(true);
  });

  it('treats cancelled and refunded as final', () => {
    expect(allowedTransitions(OrderStatus.CANCELLED)).toEqual([]);
    expect(allowedTransitions(OrderStatus.REFUNDED)).toEqual([]);
  });

  it('never moves a paid order back to awaiting payment', () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PENDING_PAYMENT)).toBe(false);
  });
});

describe('stock rules', () => {
  it('limits tracked variants to their count', () => {
    expect(hasStock({ stockQuantity: 2, trackInventory: true }, 2)).toBe(true);
    expect(hasStock({ stockQuantity: 2, trackInventory: true }, 3)).toBe(false);
    expect(availableStock({ stockQuantity: -1, trackInventory: true })).toBe(0);
  });

  it('never runs out for unlimited variants', () => {
    expect(hasStock({ stockQuantity: 0, trackInventory: false }, 1000)).toBe(true);
    expect(availableStock({ stockQuantity: 0, trackInventory: false })).toBe(Infinity);
  });
});
