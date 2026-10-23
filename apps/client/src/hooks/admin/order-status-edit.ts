import type { AdminOrder } from '@/components/admin/orders/types';

/** The status form of an order card: what the admin picked so far. */
export type OrderStatusDraft = {
  status: string;
  trackingNumber: string;
};

/** The form's starting point: the order as it is. */
export function draftFromOrder(order: Pick<AdminOrder, 'status' | 'trackingNumber'>): OrderStatusDraft {
  return { status: order.status, trackingNumber: order.trackingNumber || '' };
}

/** True when the picked status differs from the order's current one. */
export function isStatusChanging(order: Pick<AdminOrder, 'status'>, draft: OrderStatusDraft): boolean {
  return draft.status !== order.status;
}

/** Nothing to save: same status and same tracking number. */
export function isUpdateUnchanged(order: Pick<AdminOrder, 'status' | 'trackingNumber'>, draft: OrderStatusDraft): boolean {
  return draft.status === order.status && draft.trackingNumber.trim() === (order.trackingNumber || '');
}

/** Key that changes whenever the saved order changes, so the form starts over from the new order. */
export function draftKey(order: Pick<AdminOrder, 'id' | 'status' | 'trackingNumber'>): string {
  return `${order.id}:${order.status}:${order.trackingNumber ?? ''}`;
}
