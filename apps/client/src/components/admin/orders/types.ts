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

export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export type OrderRefund = {
  id: string;
  orderId: string;
  amount: string;
  status: RefundStatus;
  providerRef?: string | null;
  note?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  completedByEmail?: string | null;
};

/** One status change of the order's history (the list is oldest first). */
export type OrderStatusEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  /** Null for changes the system made (customer self-cancel, payment, provider refund). */
  changedByEmail: string | null;
  createdAt: string;
};

/** Emails an admin can send again (POST /admin/orders/:id/resend-email). */
export const RESEND_TEMPLATES = [
  'order-confirmation',
  'admin-new-order',
  'order-processing',
  'order-shipped',
  'order-delivered',
  'order-cancelled',
  'refund-completed',
] as const;

export type ResendTemplate = (typeof RESEND_TEMPLATES)[number];

export type AdminOrder = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  recipientName?: string | null;
  phone?: string | null;
  locale?: string | null;
  status: string;
  subtotal: string;
  shippingCost: string;
  discountAmount: string;
  total: string;
  coupon?: { code: string } | null;
  trackingNumber?: string | null;
  paymentRef?: string | null;
  paymentMethod?: string | null;
  paymentInstallments?: number | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string | null;
  shippingZip?: string | null;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  deliveryMethod?: 'COURIER' | 'PICKUP_POINT';
  pickupPointName?: string | null;
  marketingConsent?: boolean;
  items: OrderItem[];
  allowedTransitions?: string[];
  cancellationRequests?: OrderCancellationRequest[];
  refunds?: OrderRefund[];
  statusEvents?: OrderStatusEvent[];
  cancellation?: { canSelfCancel: boolean; canRequest: boolean; requiresReturn: boolean; openRequest: unknown };
};

/** GET /admin/orders response. */
export type AdminOrdersResponse = {
  orders: AdminOrder[];
  total: number;
  totalPages: number;
};

/** GET /admin/refunds row: the refund with a summary of its order. */
export type AdminRefundRow = OrderRefund & {
  order: {
    orderNumber: string;
    status: string;
    customerEmail: string;
    recipientName?: string | null;
    phone?: string | null;
    total: string;
    paymentRef?: string | null;
    paymentMethod?: string | null;
    cardBrand?: string | null;
    cardLast4?: string | null;
    paidAt?: string | null;
    cancelledAt?: string | null;
  };
};

/** GET /admin/refunds response. */
export type AdminRefundsResponse = {
  refunds: AdminRefundRow[];
  total: number;
  pendingCount: number;
  totalPages: number;
};
