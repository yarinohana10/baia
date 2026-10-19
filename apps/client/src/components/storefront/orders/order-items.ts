import type { OrderItem } from '@/lib/orders';

/** The product name recorded on the order line, in Hebrew when there is one and the shop is in Hebrew. */
export function orderItemName(item: Pick<OrderItem, 'productName' | 'productNameHe'>, locale: string): string {
  return (locale === 'he' && item.productNameHe) || item.productName;
}
