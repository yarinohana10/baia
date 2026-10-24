'use client';

import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import type { OrderItem } from '@/lib/orders';
import { money } from './money';
import { orderItemName } from './order-items';
import { OrderItemThumb } from './OrderItemThumb';

/** One row per ordered item: photo, name (colour/size) × quantity, and the line total. */
export function OrderLines({ items, className }: { items: OrderItem[]; className?: string }) {
  const locale = useLocale();
  return (
    <ul className={cn('border-t border-gray-100 pt-4 space-y-3', className)}>
      {items.map((item) => {
        const name = orderItemName(item, locale);
        return (
          <li key={item.id} className="flex items-center gap-3 text-sm">
            <OrderItemThumb src={item.imageUrl} alt={name} />
            <span className="min-w-0 flex-1">
              {name}
              <span className="block text-xs text-black/50">
                {item.color} / {item.size} ×{item.quantity}
              </span>
            </span>
            <span className="shrink-0">{money(Number(item.unitPrice) * item.quantity)}</span>
          </li>
        );
      })}
    </ul>
  );
}
