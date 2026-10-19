import type { CustomerOrder } from '@/lib/orders';

const PAID_STATUSES: CustomerOrder['status'][] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** The order was paid (whatever happened to it since). */
export function isPaid(order: Pick<CustomerOrder, 'status'>): boolean {
  return PAID_STATUSES.includes(order.status);
}
