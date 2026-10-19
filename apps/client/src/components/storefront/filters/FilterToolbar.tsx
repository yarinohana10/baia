'use client';

import { useTranslations } from 'next-intl';
import { isPriceFiltered, type FilterAvailability } from '@/lib/catalog/filter-options';
import type { ListingFilters } from '@/lib/catalog/query';
import { FilterPopover } from './FilterPopover';
import type { FilterControls } from './types';

type Props = {
  filters: ListingFilters;
  controls: FilterControls;
  available: FilterAvailability;
};

const withCount = (label: string, values: string[] | undefined) => (values?.length ? `${label} (${values.length})` : label);

/** Desktop: a dropdown per filter, then the in-stock switch. */
export function FilterToolbar({ filters, controls, available }: Props) {
  const t = useTranslations('filters');
  return (
    <div className="hidden flex-wrap items-center gap-2 md:flex" role="group" aria-label={t('label')}>
      {available.sizes && (
        <FilterPopover label={withCount(t('size'), filters.sizes)} active={!!filters.sizes?.length} title={t('size')}>
          {controls.sizes}
        </FilterPopover>
      )}
      {available.colors && (
        <FilterPopover label={withCount(t('color'), filters.colors)} active={!!filters.colors?.length} title={t('color')}>
          {controls.colors}
        </FilterPopover>
      )}
      {available.price && (
        <FilterPopover label={t('price')} active={isPriceFiltered(filters)} title={t('price')}>
          {controls.price}
        </FilterPopover>
      )}
      <div className="ms-1">{controls.inStock}</div>
    </div>
  );
}
