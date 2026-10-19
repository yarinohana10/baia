'use client';

import { useTranslations } from 'next-intl';
import { Home, MapPin } from 'lucide-react';
import { formatEta, type CustomerOrder } from '@/lib/orders';
import { etaFor, useCartStore } from '@/store/cart';

/** Courier address or pickup point, the phone, and the delivery estimate until it ships. */
export function OrderDelivery({ order, showEta }: { order: CustomerOrder; showEta: boolean }) {
  const t = useTranslations('orderConfirmation');
  const tPage = useTranslations('orderPage');
  const tDelivery = useTranslations('delivery');
  const tOrders = useTranslations('orders');
  const shipping = useCartStore((s) => s.shipping);
  const pickup = order.deliveryMethod === 'PICKUP_POINT';

  return (
    <div className="border-t border-gray-100 pt-4 text-sm">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
        {pickup ? <MapPin size={12} aria-hidden="true" /> : <Home size={12} aria-hidden="true" />}
        {pickup ? tDelivery('pickup') : tDelivery('courier')}
      </p>
      {pickup ? (
        <>
          {order.pickupPointName && <p className="font-medium">{order.pickupPointName}</p>}
          <p>
            {order.shippingStreet}, {order.shippingCity}
          </p>
          {order.recipientName && (
            <p className="mt-1 text-gray-500">
              {tPage('collectedBy')}: {order.recipientName}
            </p>
          )}
        </>
      ) : (
        <>
          {order.recipientName && <p className="font-medium">{order.recipientName}</p>}
          <p>
            {order.shippingStreet} {order.shippingNumber}
            {order.shippingApartment ? `, ${t('apt')} ${order.shippingApartment}` : ''}
          </p>
          <p>
            {order.shippingCity} {order.shippingZip}
          </p>
        </>
      )}
      {order.phone && (
        <p className="mt-1">
          <span className="text-gray-400">{tOrders('phone')}: </span>
          <span dir="ltr">{order.phone}</span>
        </p>
      )}
      {showEta && (
        <p className="mt-2 text-xs text-gray-500">
          {tDelivery('eta', { days: formatEta(etaFor(shipping, order.deliveryMethod)) })}
        </p>
      )}
    </div>
  );
}
