'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { withSelectedOptions } from '@/lib/catalog/filter-options';
import type { Facets } from '@/lib/catalog/types';

type Props = {
  facets: Facets;
  selected?: string[];
  onToggle: (size: string) => void;
};

/** Size filter: a toggle button per size. */
export function SizeOptions({ facets, selected = [], onToggle }: Props) {
  const t = useTranslations('filters');
  // Keep selected sizes visible even if they just sold out, so they can be removed.
  const options = withSelectedOptions(facets.sizes, selected);
  if (options.length === 0) return <p className="text-sm text-gray-500">{t('noOptions')}</p>;
  const isSelected = new Set(selected);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value: size }) => {
          const on = isSelected.has(size);
          return (
            <button
              key={size}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(size)}
              className={cn(
                'h-10 min-w-11 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                on ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 text-charcoal hover:border-ocean-600',
              )}
            >
              <span dir="ltr">{size}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{t('sizeHint')}</p>
    </div>
  );
}
