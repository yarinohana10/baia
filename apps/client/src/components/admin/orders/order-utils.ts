import type { AdminOrder, OrderItem } from './types';
import { PAID_STATUSES } from './types';

/** The item's name in the admin's language (Hebrew when there is one). */
export function orderItemName(item: OrderItem, locale: string): string {
  return locale === 'he' && item.productNameHe ? item.productNameHe : item.productName;
}

/** Total number of units in the order. */
export function orderItemCount(order: AdminOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** True while a customer cancellation request waits for the admin. */
export function hasOpenCancellationRequest(order: AdminOrder): boolean {
  return (order.cancellationRequests ?? []).some((r) => r.status === 'REQUESTED');
}

export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.includes(status);
}
