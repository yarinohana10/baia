'use client';

import { useTranslations } from 'next-intl';
import { Truck } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { freeShippingProgress } from '@/lib/orders';
import { cn } from '@/lib/utils';

/** "עוד ₪X למשלוח חינם" with a progress bar (cart page, cart drawer, checkout). */
export function FreeShippingProgress({
  subtotal,
  threshold,
  className,
}: {
  subtotal: number;
  threshold: number;
  className?: string;
}) {
  const t = useTranslations('delivery');
  if (subtotal <= 0) return null;
  const { remaining, percent, reached } = freeShippingProgress(subtotal, threshold);
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className={cn('flex items-center gap-1.5 text-xs', reached ? 'text-green-700' : 'text-gray-600')}>
        <Truck size={13} aria-hidden="true" className="shrink-0" />
        {reached ? t('freeShippingReached') : t('freeShippingRemaining', { amount: formatPrice(remaining) })}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('freeShippingProgressLabel')}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', reached ? 'bg-green-500' : 'bg-ocean-600')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
