'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { isInStock, swatchColor } from '@/lib/catalog/pricing';
import type { Variant } from '@/lib/catalog/types';
import { useColorName } from '@/hooks/catalog/useColorName';

type Props = {
  colors: string[];
  selected: string;
  variants: Variant[];
  onSelect: (color: string) => void;
};

/** Colour swatches (or text pills for colours without a known swatch); colours with nothing in stock are struck through (still selectable, to see photos and sizes). */
export function ColorPicker({ colors, selected, variants, onSelect }: Props) {
  const t = useTranslations('pdp');
  const colorName = useColorName();
  const inStock = new Set<string>();
  for (const v of variants) {
    if (isInStock(v)) inStock.add(v.color);
  }
  return (
    <fieldset className="mb-5">
      <legend className="mb-3 text-[13px] text-black">
        {t('color')} <span className="text-black/50">· {colorName(selected)}</span>
      </legend>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const swatch = swatchColor(color);
          const isSelected = selected === color;
          const soldOut = !inStock.has(color);
          const label = colorName(color);
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              aria-pressed={isSelected}
              aria-label={soldOut ? `${t('colorOption', { color: label })} – ${t('backSoon')}` : t('colorOption', { color: label })}
              title={label}
              className={cn(
                'relative rounded-full transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black',
                swatch
                  ? 'size-6 ring-1 ring-black/10 ring-offset-[3px]'
                  : 'border px-3.5 py-1.5 text-sm',
                swatch && isSelected && 'ring-[1.5px] ring-black',
                !swatch && (isSelected ? 'border-black bg-black text-white' : 'border-black/25 hover:border-black'),
                soldOut && 'opacity-50',
              )}
              style={swatch ? { backgroundColor: swatch } : undefined}
            >
              {!swatch && label}
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
