'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isInStock } from '@/lib/catalog/pricing';
import type { Variant } from '@/lib/catalog/types';

type Props = {
  /** The selected colour's variants, in size-set order. */
  options: Variant[];
  selected: string;
  onSelect: (size: string) => void;
  /** "Only N left" count for the selected size, or null. */
  lowStock: number | null;
  /** Shown next to the legend (the size-guide link). */
  guide: ReactNode;
};

/** Size buttons for the selected colour; sold-out sizes are disabled and struck through. */
export function SizePicker({ options, selected, onSelect, lowStock, guide }: Props) {
  const t = useTranslations('pdp');
  return (
    <fieldset className="mb-6">
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <legend className="text-sm font-medium text-charcoal">{t('size')}</legend>
        {guide}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((v) => {
          const inStock = isInStock(v);
          const isSelected = selected === v.size;
          return (
            <button
              key={v.size}
              type="button"
              onClick={() => onSelect(v.size)}
              disabled={!inStock}
              aria-pressed={isSelected}
              aria-label={inStock ? t('sizeOption', { size: v.size }) : t('sizeSoldOut', { size: v.size })}
              className={cn(
                'relative h-11 min-w-12 overflow-hidden rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                isSelected && inStock && 'border-ocean-700 bg-ocean-700 text-white',
                !isSelected && inStock && 'border-gray-300 text-charcoal hover:border-ocean-600',
                !inStock &&
                  'cursor-not-allowed border-gray-200 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),#d1d5db_50%,transparent_calc(50%+0.5px))] text-gray-400 line-through',
              )}
            >
              <span dir="ltr">{v.size}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-[13px] font-medium text-amber-700" aria-live="polite">
        {lowStock !== null ? t('lowStock', { count: lowStock }) : ''}
      </p>
    </fieldset>
  );
}
