'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isInStock, swatchColor } from '@/lib/catalog/pricing';
import type { Variant } from '@/lib/catalog/types';

type Props = {
  colors: string[];
  selected: string;
  variants: Variant[];
  onSelect: (color: string) => void;
};

/** Colour swatches (or text pills for colours without a known swatch); colours with nothing in stock are struck through (still selectable, to see photos and sizes). */
export function ColorPicker({ colors, selected, variants, onSelect }: Props) {
  const t = useTranslations('pdp');
  const inStock = new Set<string>();
  for (const v of variants) {
    if (isInStock(v)) inStock.add(v.color);
  }
  return (
    <fieldset className="mb-6">
      <legend className="mb-2.5 text-sm text-gray-600">
        <span className="font-medium text-charcoal">{t('color')}:</span> {selected}
      </legend>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((color) => {
          const swatch = swatchColor(color);
          const isSelected = selected === color;
          const soldOut = !inStock.has(color);
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              aria-pressed={isSelected}
              aria-label={soldOut ? `${t('colorOption', { color })} – ${t('backSoon')}` : t('colorOption', { color })}
              title={color}
              className={cn(
                'relative rounded-full transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                swatch
                  ? 'size-9 ring-1 ring-gray-300 ring-offset-2'
                  : 'border px-3.5 py-1.5 text-sm',
                swatch && isSelected && 'ring-2 ring-ocean-700',
                !swatch && (isSelected ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'),
                soldOut && 'opacity-50',
              )}
              style={swatch ? { backgroundColor: swatch } : undefined}
            >
              {!swatch && color}
              {swatch && soldOut && (
                <span aria-hidden="true" className="absolute inset-0 m-auto h-px w-full rotate-45 bg-gray-500" />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
