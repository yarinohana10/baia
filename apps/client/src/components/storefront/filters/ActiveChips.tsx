'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { activeFilterChips, type FilterChip } from '@/lib/catalog/filter-options';
import type { ListingFilters } from '@/lib/catalog/query';

type FiltersT = ReturnType<typeof useTranslations<'filters'>>;

type Props = {
  filters: ListingFilters;
  onApply: (patch: Partial<ListingFilters>) => void;
  onClearAll: () => void;
  locale: string;
};

function priceLabel(t: FiltersT, minPrice: number | undefined, maxPrice: number | undefined): string {
  const min = minPrice !== undefined ? formatPrice(minPrice) : undefined;
  const max = maxPrice !== undefined ? formatPrice(maxPrice) : undefined;
  if (min && max) return t('priceBetween', { min, max });
  if (min) return t('priceFrom', { min });
  return t('priceUpTo', { max: max ?? '' });
}

function chipLabel(t: FiltersT, chip: FilterChip): string {
  switch (chip.kind) {
    case 'size':
      return `${t('size')}: ${chip.value}`;
    case 'color':
      return `${t('color')}: ${chip.value}`;
    case 'price':
      return priceLabel(t, chip.min, chip.max);
    case 'inStock':
      return t('inStock');
  }
}

/** Removable chips for the active filters, plus "Clear all". */
export function ActiveChips({ filters, onApply, onClearAll, locale }: Props) {
  const t = useTranslations('filters');
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t('active')} role="group" lang={locale}>
      {activeFilterChips(filters).map((chip) => {
        const label = chipLabel(t, chip);
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onApply(chip.remove)}
            aria-label={t('remove', { label })}
            className="inline-flex h-8 items-center gap-1.5 rounded-none bg-[#F7F7F7] px-3 text-[13px] text-black hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-700"
          >
            {label}
            <X size={13} aria-hidden="true" />
          </button>
        );
      })}
      <button
        type="button"
        onClick={onClearAll}
        className="ms-1 text-[13px] text-gray-600 underline underline-offset-4 hover:text-black"
      >
        {t('clearAll')}
      </button>
    </div>
  );
}
