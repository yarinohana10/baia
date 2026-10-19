'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/catalog/pricing';
import { FreeShippingProgress } from '@/components/storefront/FreeShippingProgress';

/** Subtotal, shipping (with the chosen method), free-shipping progress, discount and total. */
export function CheckoutTotals({
  subtotal,
  shippingCost,
  isPickup,
  freeThreshold,
  discount,
  total,
}: {
  subtotal: number;
  shippingCost: number;
  isPickup: boolean;
  freeThreshold: number;
  discount: number;
  total: number;
}) {
  const t = useTranslations('cart');
  const tCheckout = useTranslations('checkout');
  const tDelivery = useTranslations('delivery');
  const freeShipping = shippingCost === 0;
  return (
    <div className="border-t border-gray-200 pt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{t('subtotal')}</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-gray-500">
          {t('shipping')}
          <span className="block text-xs text-gray-400">{isPickup ? tDelivery('pickup') : tDelivery('courier')}</span>
        </span>
        <span className={freeShipping ? 'text-green-600' : ''}>
          {freeShipping ? t('freeShipping') : formatPrice(shippingCost)}
        </span>
      </div>
      <FreeShippingProgress subtotal={subtotal} threshold={freeThreshold} />
      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{tCheckout('discount')}</span>
          <span className="text-green-600">-{formatPrice(discount)}</span>
        </div>
      )}
      <div className="border-t border-gray-200 pt-3 flex justify-between font-medium text-lg">
        <span>{t('total')}</span>
        <span>{formatPrice(total)}</span>
      </div>
      <p className="text-xs text-gray-400">{tDelivery('vatIncluded')}</p>
    </div>
  );
}
