'use client';

import { useTranslations } from 'next-intl';
import { Home, MapPin } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatEta } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { etaFor, shippingFor, type DeliveryMethod, type ShippingConfig } from '@/store/cart';

const METHOD_COPY = {
  COURIER: { icon: Home, name: 'courier', description: 'courierDescription' },
  PICKUP_POINT: { icon: MapPin, name: 'pickup', description: 'pickupDescription' },
} as const;

/** One delivery radio card: icon, name, price (or free), description and ETA. */
export function DeliveryMethodOption({
  method,
  selected,
  locked,
  subtotal,
  shipping,
  onSelect,
}: {
  method: DeliveryMethod;
  selected: boolean;
  locked: boolean;
  subtotal: number;
  shipping: ShippingConfig;
  onSelect: () => void;
}) {
  const t = useTranslations('cart');
  const tDelivery = useTranslations('delivery');
  const { icon: Icon, name, description } = METHOD_COPY[method];
  const cost = shippingFor(subtotal, shipping, method);
  const free = cost === 0;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={locked}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-none border p-4 text-start transition-colors disabled:cursor-not-allowed',
        selected ? 'border-neutral-700 bg-[#F7F7F7]/60 ring-1 ring-neutral-700' : 'border-gray-200 hover:border-neutral-400',
        locked && !selected && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          selected ? 'bg-black text-white' : 'bg-gray-100 text-gray-500',
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">{tDelivery(name)}</span>
          <span className={cn('text-sm font-medium', free ? 'text-green-600' : 'text-gray-900')}>
            {free ? t('freeShipping') : formatPrice(cost)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">{tDelivery(description)}</span>
        <span className="mt-1 block text-xs text-gray-400">
          {tDelivery('eta', { days: formatEta(etaFor(shipping, method)) })}
        </span>
      </span>
    </button>
  );
}
