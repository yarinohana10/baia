'use client';

import { useTranslations } from 'next-intl';
import { Package } from 'lucide-react';
import type { DeliveryMethod, ShippingConfig } from '@/store/cart';
import { PickupPointPicker, type PickupPoint } from '@/components/storefront/orders/PickupPointPicker';
import { DeliveryMethodOption } from './DeliveryMethodOption';
import { checkoutSectionClass, sectionTitleClass } from './styles';

const DELIVERY_METHODS: DeliveryMethod[] = ['COURIER', 'PICKUP_POINT'];

/** Courier vs. pickup point, and the pickup point list when picking up. */
export function DeliverySection({
  method,
  pickupPoint,
  pickupMissing,
  locked,
  subtotal,
  shipping,
  onMethodChange,
  onPickupPointChange,
}: {
  method: DeliveryMethod;
  pickupPoint: PickupPoint | null;
  pickupMissing: boolean;
  locked: boolean;
  subtotal: number;
  shipping: ShippingConfig;
  onMethodChange: (method: DeliveryMethod) => void;
  onPickupPointChange: (point: PickupPoint | null) => void;
}) {
  const tDelivery = useTranslations('delivery');
  return (
    <section id="checkout-delivery" className={`${checkoutSectionClass} space-y-4`}>
      <h2 className={sectionTitleClass}>
        <Package size={16} /> {tDelivery('title')}
      </h2>
      <div role="radiogroup" aria-label={tDelivery('title')} className="grid gap-3 sm:grid-cols-2">
        {DELIVERY_METHODS.map((option) => (
          <DeliveryMethodOption
            key={option}
            method={option}
            selected={method === option}
            locked={locked}
            subtotal={subtotal}
            shipping={shipping}
            onSelect={() => onMethodChange(option)}
          />
        ))}
      </div>

      {method === 'PICKUP_POINT' && (
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500">{tDelivery('choosePoint')}</p>
          <PickupPointPicker value={pickupPoint} onChange={onPickupPointChange} disabled={locked} invalid={pickupMissing} />
          {pickupMissing && (
            <p role="alert" className="text-xs text-red-500">{tDelivery('pointRequired')}</p>
          )}
          <p className="text-xs text-gray-400">{tDelivery('pickupNotice')}</p>
        </div>
      )}
    </section>
  );
}
