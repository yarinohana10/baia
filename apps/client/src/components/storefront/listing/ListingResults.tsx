import type { ReactNode } from 'react';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { Pagination } from '@/components/storefront/Pagination';
import { ListingFilters } from '@/components/storefront/filters/ListingFilters';
import { FilteredEmpty } from '@/components/storefront/filters/FilteredEmpty';
import { toCardProduct } from '@/lib/catalog/server';
import { activeFilterCount, clearFilters, listingHref, type ListingQuery } from '@/lib/catalog/query';
import type { Facets, Product } from '@/lib/catalog/types';

type Props = {
  basePath: string;
  query: ListingQuery;
  facets: Facets;
  products: Product[];
  total: number;
  totalPages: number;
  /** Shown next to the sort control (e.g. "24 products"). */
  countLabel: string;
  /** Shown instead of the results when the listing itself is empty (no filters applied). */
  empty: ReactNode;
};

/**
 * Shared body of the category / new-arrivals / search listings: filters + sort,
 * then the product grid with pagination. With no products it shows `empty`, or
 * the "no matches, clear filters" state when filters narrowed the results.
 */
export function ListingResults({ basePath, query, facets, products, total, totalPages, countLabel, empty }: Props) {
  if (products.length === 0 && activeFilterCount(query) === 0) return empty;
  return (
    <>
      <ListingFilters basePath={basePath} query={query} facets={facets} total={total} countLabel={countLabel} />
      {products.length === 0 ? (
        <FilteredEmpty clearHref={listingHref(basePath, clearFilters(query))} />
      ) : (
        <>
          <ProductGrid products={products.map(toCardProduct)} priorityCount={4} />
          <Pagination basePath={basePath} query={query} totalPages={totalPages} />
        </>
      )}
    </>
  );
}
