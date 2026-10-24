'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SortSelect } from '@/components/storefront/SortSelect';
import { useFilterNavigation } from '@/hooks/catalog/useFilterNavigation';
import { filterAvailability } from '@/lib/catalog/filter-options';
import { activeFilterCount, toggleValue, type ListingQuery } from '@/lib/catalog/query';
import type { Facets } from '@/lib/catalog/types';
import { ActiveChips } from './ActiveChips';
import { ColorOptions } from './ColorOptions';
import { FilterSheet } from './FilterSheet';
import { FilterSheetButton } from './FilterSheetButton';
import { FilterToolbar } from './FilterToolbar';
import { InStockToggle } from './InStockToggle';
import { PriceRange } from './PriceRange';
import { SizeOptions } from './SizeOptions';
import type { FilterControls } from './types';

type Props = {
  basePath: string;
  query: ListingQuery;
  facets: Facets;
  total: number;
  /** Shown next to the sort control (e.g. "24 products"). */
  countLabel: string;
};

/**
 * Listing filters for category / new-arrivals / search pages.
 * Desktop: a toolbar of dropdowns (size, color, price, in stock) + sort.
 * Phones: a "Filter" button opening a side sheet with the same controls.
 * Active filters show as removable chips with "Clear all".
 */
export function ListingFilters({ basePath, query, facets, total, countLabel }: Props) {
  const t = useTranslations('filters');
  const locale = useLocale();
  const { pending, apply, clearAll } = useFilterNavigation(basePath, query);
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = activeFilterCount(query);
  const available = filterAvailability(facets, query);

  const controls: FilterControls = {
    sizes: <SizeOptions facets={facets} selected={query.sizes} onToggle={(s) => apply({ sizes: toggleValue(query.sizes, s) })} />,
    colors: (
      <ColorOptions facets={facets} selected={query.colors} onToggle={(c) => apply({ colors: toggleValue(query.colors, c) })} />
    ),
    price: (
      <PriceRange
        key={`${query.minPrice ?? ''}-${query.maxPrice ?? ''}`}
        facets={facets}
        min={query.minPrice}
        max={query.maxPrice}
        onApply={(minPrice, maxPrice) => apply({ minPrice, maxPrice })}
      />
    ),
    inStock: <InStockToggle checked={!!query.inStock} onChange={(v) => apply({ inStock: v || undefined })} />,
  };

  return (
    <div className="mb-6" aria-busy={pending}>
      <div className="flex items-center justify-between gap-3 border-y border-black/10 py-2.5">
        <FilterSheetButton activeCount={active} onClick={() => setSheetOpen(true)} />
        <FilterToolbar filters={query} controls={controls} available={available} />
        <div className="flex items-center gap-4 text-[12px] text-black/55">
          <span aria-live="polite" className="hidden sm:inline">
            {pending ? t('updating') : countLabel}
          </span>
          {total > 1 && <SortSelect basePath={basePath} query={query} />}
        </div>
      </div>

      {active > 0 && <ActiveChips filters={query} onApply={apply} onClearAll={clearAll} locale={locale} />}

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        locale={locale}
        controls={controls}
        available={available}
        activeCount={active}
        pending={pending}
        total={total}
        onClearAll={clearAll}
      />
    </div>
  );
}
