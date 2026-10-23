'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatShekels as money } from '@/components/admin/order-status';
import { orderItemName } from './order-utils';
import type { AdminOrder } from './types';

/** The order's lines, subtotal / shipping / discount and total. */
export function OrderItemsTotals({ order }: { order: AdminOrder }) {
  const t = useTranslations('admin.orders');
  const locale = useLocale();
  const discounted = parseFloat(order.discountAmount) > 0;
  const couponCode = order.coupon?.code;

  return (
    <div className="border-t border-border pt-3 space-y-1 text-sm">
      {order.items.map((item) => (
        <div key={item.id} className="flex justify-between gap-3">
          <span className="min-w-0">
            {orderItemName(item, locale)}
            <span className="block text-xs text-muted-foreground">
              {item.color} / {item.size} · {item.quantity} × {money(item.unitPrice)}
            </span>
          </span>
          <span className="shrink-0">{money(parseFloat(item.unitPrice) * item.quantity)}</span>
        </div>
      ))}
      <div className="border-t border-border pt-2 mt-2 space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>{t('subtotal')}</span>
          <span>{money(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t('shipping')}</span>
          <span>{money(order.shippingCost)}</span>
        </div>
        {discounted && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              {t('discount')}
              {couponCode && (
                <>
                  {' '}({t('coupon')}: <span className="font-mono">{couponCode}</span>)
                </>
              )}
            </span>
            <span>-{money(order.discountAmount)}</span>
          </div>
        )}
        {!discounted && couponCode && (
          <div className="flex justify-between text-muted-foreground">
            <span>{t('coupon')}</span>
            <span className="font-mono">{couponCode}</span>
          </div>
        )}
      </div>
      <div className="border-t border-border pt-2 font-medium flex justify-between">
        <span>{t('total')}</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}
