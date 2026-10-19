/** Badge colours per order status (admin orders and customer pages). */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PROCESSING: 'bg-indigo-50 text-indigo-600',
  SHIPPED: 'bg-purple-50 text-purple-600',
  DELIVERED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-muted text-muted-foreground',
  REFUNDED: 'bg-red-50 text-destructive',
};

/** `admin.orders` message key for each order status. */
export const ORDER_STATUS_LABEL_KEYS = {
  PENDING_PAYMENT: 'pendingPayment',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export function formatShekels(value: string | number) {
  return `₪${(typeof value === 'number' ? value : parseFloat(value)).toFixed(2)}`;
}
