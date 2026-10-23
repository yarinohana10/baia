import type { AdminOrder, OrderItem, OrderRefund, OrderStatusEvent, ResendTemplate } from './types';
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

/** Where the order's money stands: still to be returned (Refund Pending) or returned. */
export type RefundState = {
  kind: 'pending' | 'completed';
  refund: OrderRefund;
};

/**
 * "Refund Pending" is a CANCELLED order whose refund is not COMPLETED yet;
 * "Refunded" is any COMPLETED refund. A completed refund wins over older rows.
 */
export function refundState(order: Pick<AdminOrder, 'status' | 'refunds'>): RefundState | null {
  const refunds = order.refunds ?? [];
  const completed = refunds.find((r) => r.status === 'COMPLETED');
  if (completed) return { kind: 'completed', refund: completed };
  if (order.status !== 'CANCELLED') return null;
  const unsettled = refunds.filter((r) => r.status === 'PENDING').at(-1) ?? refunds.filter((r) => r.status === 'FAILED').at(-1);
  return unsettled ? { kind: 'pending', refund: unsettled } : null;
}

/** A refund the admin can still mark as failed (only PENDING ones). */
export function canFailRefund(state: RefundState | null): boolean {
  return state?.kind === 'pending' && state.refund.status === 'PENDING';
}

/** Who made a status change: the admin's email, or null for the system. */
export function statusEventActor(event: OrderStatusEvent): string | null {
  return event.changedByEmail?.trim() || null;
}

/** Cancelling is offered while the lifecycle still allows it. */
export function canCancelOrder(order: Pick<AdminOrder, 'allowedTransitions'>): boolean {
  return (order.allowedTransitions ?? []).includes('CANCELLED');
}

/** Whether the order has reached the state an email is about (mirrors the server's 409 rules). */
export function canResendTemplate(order: AdminOrder, template: ResendTemplate): boolean {
  const cancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  switch (template) {
    case 'order-confirmation':
    case 'admin-new-order':
      return !!order.paidAt && (isPaidStatus(order.status) || cancelled);
    case 'order-processing':
      return ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
    case 'order-shipped':
      return !!order.shippedAt;
    case 'order-delivered':
      return !!order.deliveredAt;
    case 'order-cancelled':
      return cancelled;
    case 'refund-completed':
      return (order.refunds ?? []).some((r) => r.status === 'COMPLETED');
  }
}
