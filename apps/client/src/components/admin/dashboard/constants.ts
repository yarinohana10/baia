import { ORDER_STATUS_LABEL_KEYS } from '@/components/admin/order-status';
import type { RangePreset } from '@/lib/admin/analytics-range';

/** Main series colour (revenue, orders, units, bars of a single measure). */
export const SERIES_COLOR = '#005d72';
/** Delivered orders. */
export const DELIVERED_COLOR = '#008300';

export const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#6b7280',
};

/** `admin.dashboard.range` message key of each preset. */
export const PRESET_LABEL_KEYS = {
  today: 'today',
  yesterday: 'yesterday',
  this_week: 'thisWeek',
  last_7_days: 'last7Days',
  this_month: 'thisMonth',
  last_30_days: 'last30Days',
  this_year: 'thisYear',
  all_time: 'allTime',
} as const satisfies Record<RangePreset, string>;

type OrderStatus = keyof typeof ORDER_STATUS_LABEL_KEYS;

/** `admin.orders` message key for a status, or undefined for an unknown one. */
export function orderStatusLabelKey(status: string) {
  return Object.hasOwn(ORDER_STATUS_LABEL_KEYS, status)
    ? ORDER_STATUS_LABEL_KEYS[status as OrderStatus]
    : undefined;
}
