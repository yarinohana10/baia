import { OrderStatus } from '../generated/prisma';

/** Statuses that hand stock (and the coupon use) back. Stock returns once: on entering the first of them. */
export const RESTOCK_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

const FULFILMENT: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** Statuses after a successful payment. */
export const PAID_STATUSES: OrderStatus[] = [...FULFILMENT];

/**
 * Allowed admin status changes. Fulfilment steps may move back and forth to
 * correct mistakes. Cancelled/refunded orders are never reopened (that would
 * sell stock that has already been returned); the one exception is
 * CANCELLED -> REFUNDED, which settles the order's Refund and restocks nothing.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === OrderStatus.CANCELLED) return to === OrderStatus.REFUNDED;
  if (RESTOCK_STATUSES.includes(from)) return false;
  if (to === OrderStatus.PENDING_PAYMENT) return false;
  if (from === OrderStatus.PENDING_PAYMENT) return to === OrderStatus.CONFIRMED || to === OrderStatus.CANCELLED;
  return FULFILMENT.includes(to) || RESTOCK_STATUSES.includes(to);
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return Object.values(OrderStatus).filter((to) => to !== from && canTransition(from, to));
}
