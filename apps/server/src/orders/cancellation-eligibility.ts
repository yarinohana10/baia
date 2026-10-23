import { CancellationStatus, OrderStatus } from '../generated/prisma';

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

/** Until the parcel ships the customer cancels instantly (refunded in full when paid). */
const SELF_CANCELLABLE: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
/** Once shipped, the store reviews a Cancellation Request (the parcel must be returned). */
const REQUESTABLE: OrderStatus[] = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];

export type EligibilityOrder = { status: OrderStatus };

export type OpenRequest = { id: string; status: CancellationStatus; reason: string; createdAt: Date } | null;

export type CancellationInfo = {
  /** Cancel right now, free of charge (and refunded in full when paid). */
  canSelfCancel: boolean;
  /** File a request the store reviews (shipped / delivered orders). */
  canRequest: boolean;
  /** The parcel is already on its way / delivered: it must be returned. */
  requiresReturn: boolean;
  openRequest: { id: string; status: CancellationStatus; reason: string; createdAt: string } | null;
};

export function cancellationEligibility(order: EligibilityOrder, openRequest: OpenRequest): CancellationInfo {
  const requestable = REQUESTABLE.includes(order.status);
  return {
    canSelfCancel: !openRequest && SELF_CANCELLABLE.includes(order.status),
    canRequest: !openRequest && requestable,
    requiresReturn: requestable,
    openRequest: openRequest ? { ...openRequest, createdAt: openRequest.createdAt.toISOString() } : null,
  };
}

/** Legal cap for a cancellation fee outside the free window: 5% or ₪100, the lower. */
export function suggestedCancellationFee(total: number): number {
  return Math.round(Math.min(total * 0.05, 100) * 100) / 100;
}
