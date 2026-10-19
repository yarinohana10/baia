import { ORDER_STATUS_LABEL_KEYS } from '@/components/admin/order-status';

/** Days covered by the sales chart and the orders CSV export. */
export const SALES_DAYS = 30;

export const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#6b7280',
};

export const CATEGORY_REVENUE_COLORS = ['#005d72', '#007791', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

type OrderStatus = keyof typeof ORDER_STATUS_LABEL_KEYS;

/** `admin.orders` message key for a status, or undefined for an unknown one. */
export function orderStatusLabelKey(status: string) {
  return Object.hasOwn(ORDER_STATUS_LABEL_KEYS, status)
    ? ORDER_STATUS_LABEL_KEYS[status as OrderStatus]
    : undefined;
}
