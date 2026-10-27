'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLightColor, swatchColor } from '@/lib/catalog/pricing';
import { withSelectedOptions } from '@/lib/catalog/filter-options';
import type { Facets } from '@/lib/catalog/types';
import { useColorName } from '@/hooks/catalog/useColorName';

type Props = {
  facets: Facets;
  selected?: string[];
  onToggle: (color: string) => void;
};

/** Colour filter: a checkbox per colour with its swatch and product count. */
export function ColorOptions({ facets, selected = [], onToggle }: Props) {
  const t = useTranslations('filters');
  const colorName = useColorName();
  const options = withSelectedOptions(facets.colors, selected);
  if (options.length === 0) return <p className="text-sm text-gray-500">{t('noOptions')}</p>;
  const isSelected = new Set(selected);
  return (
    <ul className="grid grid-cols-2 gap-1">
      {options.map(({ value, count }) => {
        const on = isSelected.has(value);
        const swatch = swatchColor(value);
        return (
          <li key={value}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(value)}
              className="flex w-full items-center gap-2.5 rounded-none px-2 py-2 text-start text-sm text-charcoal hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-700"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-gray-300',
                  on && 'ring-2 ring-black ring-offset-1',
                  !swatch && 'bg-[conic-gradient(#e56b5a,#e8c33f,#3f6e4e,#2b5c9e,#6a4a8c,#e56b5a)]',
                )}
                style={swatch ? { backgroundColor: swatch } : undefined}
              >
                {on && <Check size={12} className={swatch && isLightColor(swatch) ? 'text-charcoal' : 'text-white'} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{colorName(value)}</span>
              {count > 0 && <span className="text-xs text-gray-400 tabular-nums">{count}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
