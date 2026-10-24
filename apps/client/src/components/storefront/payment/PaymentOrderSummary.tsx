'use client';

import { useTranslations } from 'next-intl';
import type { CustomerOrder } from '@/lib/orders';
import { OrderLines } from '@/components/storefront/orders/OrderLines';

/** The order's lines and the amount due, beside the payment form. */
export function PaymentOrderSummary({ order, amount }: { order: CustomerOrder; amount: string }) {
  const t = useTranslations('payment');
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <aside className="lg:col-span-2 bg-gray-50 border border-gray-200 rounded-none p-5 sm:p-6" aria-labelledby="pay-summary">
      <h2 id="pay-summary" className="font-medium mb-1">
        {t('orderSummary')}
      </h2>
      <p className="text-xs text-gray-500 mb-4">{t('items', { count: itemCount })}</p>
      <OrderLines items={order.items} className="mb-4 border-t-0 pt-0" />
      <div className="border-t border-gray-200 pt-4 flex items-baseline justify-between">
        <span className="text-sm text-gray-500">{t('amountDue')}</span>
        <span className="text-2xl font-semibold">{amount}</span>
      </div>
    </aside>
  );
}
