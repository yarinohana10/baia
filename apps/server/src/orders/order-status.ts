import { OrderStatus, type Prisma } from '../generated/prisma';

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

/** Fulfilment timestamps that follow the status (cleared when an admin steps back to correct a mistake). */
export function stampsFor(
  order: { paidAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null; cancelledAt: Date | null },
  status: OrderStatus,
  now: Date,
) {
  const data: Prisma.OrderUpdateInput = {};
  if (PAID_STATUSES.includes(status) && !order.paidAt) data.paidAt = now;
  if (status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED) {
    if (!order.shippedAt) data.shippedAt = now;
  } else if (order.shippedAt && !RESTOCK_STATUSES.includes(status)) {
    data.shippedAt = null;
  }
  if (status === OrderStatus.DELIVERED) {
    if (!order.deliveredAt) data.deliveredAt = now;
  } else if (order.deliveredAt && !RESTOCK_STATUSES.includes(status)) {
    data.deliveredAt = null;
  }
  if (RESTOCK_STATUSES.includes(status) && !order.cancelledAt) data.cancelledAt = now;
  return data;
}
