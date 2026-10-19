/**
 * Shopper-side order types and helpers (order page, account orders, order
 * status lookup, cancellation). Strings live in messages/<locale>/orders.json.
 */

export type DeliveryMethod = 'COURIER' | 'PICKUP_POINT';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type CancellationReason = 'SIZE' | 'CHANGED_MIND' | 'ORDERED_BY_MISTAKE' | 'SHIPPING_DELAY' | 'OTHER';

/** Order of the options in the reason select. */
export const CANCELLATION_REASONS: CancellationReason[] = [
  'SIZE',
  'CHANGED_MIND',
  'ORDERED_BY_MISTAKE',
  'SHIPPING_DELAY',
  'OTHER',
];

export type CancellationInfo = {
  canSelfCancel: boolean;
  selfCancelDeadline: string | null;
  canRequest: boolean;
  requiresReturn: boolean;
  windowHours: number;
  openRequest: { id: string; status: string; reason: string; createdAt: string } | null;
};

export type CustomerCancellationRequest = {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'AUTO_CANCELLED';
  reason: string;
  feeAmount: string;
  refundAmount: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type OrderItem = {
  id: string;
  productName: string;
  productNameHe?: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  userId: string | null;
  customerEmail: string;
  recipientName: string | null;
  phone: string | null;
  trackingNumber: string | null;
  subtotal: string;
  shippingCost: string;
  discountAmount: string;
  total: string;
  deliveryMethod: DeliveryMethod;
  pickupPointName: string | null;
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment: string | null;
  shippingZip: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
  cancellationRequests?: CustomerCancellationRequest[];
  cancellation?: CancellationInfo;
};

export type TimelineStep = 'received' | 'paid' | 'processing' | 'shipped' | 'delivered';
export const TIMELINE_STEPS: TimelineStep[] = ['received', 'paid', 'processing', 'shipped', 'delivered'];

const STEP_INDEX: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
  CANCELLED: -1,
  REFUNDED: -1,
};

/** Index of the last completed timeline step, or -1 for cancelled/refunded orders. */
export function timelineIndex(status: OrderStatus): number {
  return STEP_INDEX[status] ?? 0;
}

export function isClosed(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED';
}

/** When each reached step happened (only the ones we record). */
export function stepDate(order: Pick<CustomerOrder, 'createdAt' | 'paidAt' | 'shippedAt'>, step: TimelineStep): string | null {
  if (step === 'received') return order.createdAt;
  if (step === 'paid') return order.paidAt;
  if (step === 'shipped') return order.shippedAt;
  return null;
}

/**
 * Carrier tracking link. Set NEXT_PUBLIC_TRACKING_URL_TEMPLATE (e.g.
 * "https://carrier.example/track?n={tracking}") once a courier is chosen.
 */
export function trackingUrl(trackingNumber: string | null | undefined): string | null {
  const template = process.env.NEXT_PUBLIC_TRACKING_URL_TEMPLATE?.trim();
  if (!template || !trackingNumber) return null;
  return template.replace('{tracking}', encodeURIComponent(trackingNumber));
}

/** Free-shipping progress for the cart, drawer and checkout. */
export function freeShippingProgress(subtotal: number, threshold: number) {
  if (!Number.isFinite(threshold) || threshold <= 0) return { remaining: 0, percent: 100, reached: true };
  const remaining = Math.max(0, Math.round((threshold - subtotal) * 100) / 100);
  return { remaining, percent: Math.min(100, Math.round((subtotal / threshold) * 100)), reached: remaining === 0 };
}

/** "3-5" → "3–5" for display (en dash, kept left-to-right). */
export function formatEta(days: string): string {
  return days.replace(/\s*-\s*/, '–');
}

// Guest order page: the access token travels in the URL fragment and is
// exchanged once for an httpOnly cookie (see the server's order-access.ts).
export function orderPageHref(orderId: string, token?: string | null): string {
  return `/order-confirmation/${orderId}${token ? `#token=${token}` : ''}`;
}
