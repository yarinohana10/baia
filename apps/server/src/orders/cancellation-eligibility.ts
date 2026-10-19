import { CancellationStatus, OrderStatus } from '../generated/prisma';

export const DEFAULT_SELF_CANCEL_WINDOW_HOURS = 48;

/** Reason codes shown as a select on the storefront (customer labels live in the client). */
export const CANCELLATION_REASONS = ['SIZE', 'CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'SHIPPING_DELAY', 'OTHER'] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/** Hebrew labels for the store-inbox alerts. */
export const REASON_LABELS_HE: Record<string, string> = {
  SIZE: 'מידה לא מתאימה',
  CHANGED_MIND: 'שיניתי את דעתי',
  ORDERED_BY_MISTAKE: 'הזמנתי בטעות',
  SHIPPING_DELAY: 'עיכוב במשלוח',
  OTHER: 'אחר',
};

/** Paid, not yet shipped: inside the window the customer can cancel instantly. */
const SELF_CANCELLABLE: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
/** Statuses a cancellation request (reviewed by the store) can be filed for. */
const REQUESTABLE: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export type EligibilityOrder = {
  status: OrderStatus;
  paidAt: Date | null;
  createdAt: Date;
  shippedAt: Date | null;
};

export type OpenRequest = { id: string; status: CancellationStatus; reason: string; createdAt: Date } | null;

export type CancellationInfo = {
  /** Cancel right now, free of charge (and refunded in full when paid). */
  canSelfCancel: boolean;
  /** End of the free self-service window (null when not paid or already past). */
  selfCancelDeadline: string | null;
  /** A request the store reviews (after the window, or shipped orders). */
  canRequest: boolean;
  /** The parcel is already on its way / delivered: it must be returned. */
  requiresReturn: boolean;
  windowHours: number;
  openRequest: { id: string; status: CancellationStatus; reason: string; createdAt: string } | null;
};

export function selfCancelDeadline(order: Pick<EligibilityOrder, 'paidAt' | 'createdAt'>, windowHours: number): Date {
  const start = order.paidAt ?? order.createdAt;
  return new Date(start.getTime() + windowHours * 60 * 60 * 1000);
}

export function cancellationEligibility(
  order: EligibilityOrder,
  windowHours: number,
  openRequest: OpenRequest,
  now = new Date(),
): CancellationInfo {
  const hours = Number.isFinite(windowHours) && windowHours >= 0 ? windowHours : DEFAULT_SELF_CANCEL_WINDOW_HOURS;
  const deadline = selfCancelDeadline(order, hours);
  const shipped = !!order.shippedAt || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED;
  const insideWindow = now.getTime() < deadline.getTime();

  const unpaid = order.status === OrderStatus.PENDING_PAYMENT;
  const paidSelfCancel = SELF_CANCELLABLE.includes(order.status) && !shipped && insideWindow;

  return {
    canSelfCancel: !openRequest && (unpaid || paidSelfCancel),
    selfCancelDeadline: paidSelfCancel ? deadline.toISOString() : null,
    canRequest: !openRequest && REQUESTABLE.includes(order.status),
    requiresReturn: shipped && REQUESTABLE.includes(order.status),
    windowHours: hours,
    openRequest: openRequest
      ? { ...openRequest, createdAt: openRequest.createdAt.toISOString() }
      : null,
  };
}

/** Legal cap for a cancellation fee outside the free window: 5% or ₪100, the lower. */
export function suggestedCancellationFee(total: number): number {
  return Math.round(Math.min(total * 0.05, 100) * 100) / 100;
}
