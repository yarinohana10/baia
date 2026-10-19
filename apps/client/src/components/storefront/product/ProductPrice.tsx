'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { discountPercent, formatPrice } from '@/lib/catalog/pricing';

type Props = {
  price: { current: number; original: number | null };
  /** lg: the product header (with the "save N%" badge); sm: the sticky bar. */
  size: 'lg' | 'sm';
};

/** Current price, plus the struck-through original price when on sale. */
export function ProductPrice({ price, size }: Props) {
  const t = useTranslations('pdp');
  const pct = discountPercent(price.current, price.original);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className={cn(
          'font-semibold tabular-nums',
          size === 'lg' ? 'text-2xl' : 'text-base',
          price.original ? 'text-coral' : 'text-charcoal',
        )}
      >
        <span className="sr-only">{price.original ? t('salePrice', { price: formatPrice(price.current) }) : ''}</span>
        <span aria-hidden={price.original ? true : undefined}>{formatPrice(price.current)}</span>
      </span>
      {price.original && (
        <>
          <s className={cn('text-gray-400 tabular-nums', size === 'lg' ? 'text-lg' : 'text-sm')}>
            <span className="sr-only">{t('originalPrice', { price: formatPrice(price.original) })}</span>
            <span aria-hidden="true">{formatPrice(price.original)}</span>
          </s>
          {size === 'lg' && pct > 0 && (
            <span className="rounded-full bg-coral/10 px-2 py-0.5 text-xs font-semibold text-coral" dir="ltr">
              {t('savePercent', { pct })}
            </span>
          )}
        </>
      )}
    </div>
  );
}
