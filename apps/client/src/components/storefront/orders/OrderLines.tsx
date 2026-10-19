'use client';

import { useLocale } from 'next-intl';
import type { OrderItem } from '@/lib/orders';
import { money } from './money';
import { orderItemName } from './order-items';

/** One row per ordered item: name (colour/size) × quantity, and the line total. */
export function OrderLines({ items }: { items: OrderItem[] }) {
  const locale = useLocale();
  return (
    <div className="border-t border-gray-100 pt-4 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex justify-between gap-4 text-sm">
          <span>
            {orderItemName(item, locale)} ({item.color}/{item.size}) ×{item.quantity}
          </span>
          <span>{money(Number(item.unitPrice) * item.quantity)}</span>
        </div>
      ))}
    </div>
  );
}
