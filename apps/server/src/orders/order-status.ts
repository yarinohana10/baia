import { OrderStatus } from '../generated/prisma';

/** Statuses that hand stock (and the coupon use) back. Both are final. */
export const RESTOCK_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

const FULFILMENT: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * Allowed admin status changes. Fulfilment steps may move back and forth to
 * correct mistakes; cancelled/refunded orders are final, because reopening
 * them would sell stock that has already been returned.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (RESTOCK_STATUSES.includes(from)) return false;
  if (to === OrderStatus.PENDING_PAYMENT) return false;
  if (from === OrderStatus.PENDING_PAYMENT) return to === OrderStatus.CONFIRMED || to === OrderStatus.CANCELLED;
  return FULFILMENT.includes(to) || RESTOCK_STATUSES.includes(to);
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return Object.values(OrderStatus).filter((to) => to !== from && canTransition(from, to));
}
