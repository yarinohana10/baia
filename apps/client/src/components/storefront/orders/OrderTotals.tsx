'use client';

import { useTranslations } from 'next-intl';
import type { CustomerOrder } from '@/lib/orders';
import { money } from './money';

/** Subtotal, shipping, discount and total (VAT included). */
export function OrderTotals({ order }: { order: CustomerOrder }) {
  const t = useTranslations('orderConfirmation');
  const tDelivery = useTranslations('delivery');
  return (
    <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">{t('subtotal')}</span>
        <span>{money(order.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">{t('shipping')}</span>
        <span>{Number(order.shippingCost) === 0 ? t('free') : money(order.shippingCost)}</span>
      </div>
      {Number(order.discountAmount) > 0 && (
        <div className="flex justify-between text-green-600">
          <span>{t('discount')}</span>
          <span>-{money(order.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-medium text-base pt-2 border-t border-gray-100">
        <span>{t('total')}</span>
        <span>{money(order.total)}</span>
      </div>
      <p className="text-xs text-gray-400">{tDelivery('vatIncluded')}</p>
    </div>
  );
}
