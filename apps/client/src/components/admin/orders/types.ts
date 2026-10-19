/** Order statuses, in lifecycle order (the admin status filter). */
export const ORDER_STATUSES: readonly string[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

/** Statuses that return stock to inventory, so they ask for confirmation first. */
export const RESTOCK_STATUSES: readonly string[] = ['CANCELLED', 'REFUNDED'];

/** Statuses of an order that has been paid for. */
export const PAID_STATUSES: readonly string[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Status changes that email the customer. */
export const EMAILED_STATUSES: readonly string[] = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export type OrderItem = {
  id: string;
  productName: string;
  productNameHe?: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
};

export type OrderCancellationRequest = {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  feeAmount?: string;
  refundAmount?: string | null;
  adminNote?: string | null;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  recipientName?: string | null;
  phone?: string | null;
  status: string;
  subtotal: string;
  shippingCost: string;
  discountAmount: string;
  total: string;
  coupon?: { code: string } | null;
  trackingNumber?: string | null;
  paymentRef?: string | null;
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string | null;
  shippingZip?: string | null;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  cancelledAt?: string | null;
  deliveryMethod?: 'COURIER' | 'PICKUP_POINT';
  pickupPointName?: string | null;
  marketingConsent?: boolean;
  items: OrderItem[];
  allowedTransitions?: string[];
  cancellationRequests?: OrderCancellationRequest[];
  cancellation?: { canSelfCancel: boolean; selfCancelDeadline: string | null };
};

/** GET /admin/orders response. */
export type AdminOrdersResponse = {
  orders: AdminOrder[];
  total: number;
  totalPages: number;
};
