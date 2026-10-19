'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/catalog/pricing';
import type { CustomerOrder } from '@/lib/orders';
import { orderItemName } from '@/components/storefront/orders/order-items';

/** The order's lines and the amount due, beside the payment form. */
export function PaymentOrderSummary({ order, amount }: { order: CustomerOrder; amount: string }) {
  const t = useTranslations('payment');
  const locale = useLocale();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <aside className="lg:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-5 sm:p-6" aria-labelledby="pay-summary">
      <h2 id="pay-summary" className="font-medium mb-1">
        {t('orderSummary')}
      </h2>
      <p className="text-xs text-gray-500 mb-4">{t('items', { count: itemCount })}</p>
      <ul className="space-y-2 text-sm mb-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span className="text-gray-700">
              {orderItemName(item, locale)} ({item.color}/{item.size}) ×{item.quantity}
            </span>
            <span>{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-200 pt-4 flex items-baseline justify-between">
        <span className="text-sm text-gray-500">{t('amountDue')}</span>
        <span className="text-2xl font-semibold">{amount}</span>
      </div>
    </aside>
  );
}
