import { toggleValue, type ListingFilters } from './query';
import type { Facets } from './types';

/** One selectable facet value with its product count (0 = no longer offered). */
export type FilterOption = Facets['colors'][number];

/** Which filter controls a listing offers. */
export type FilterAvailability = { sizes: boolean; colors: boolean; price: boolean };

/** A removable "active filter" chip; the UI turns it into a localized label. */
export type FilterChip =
  | { key: string; kind: 'size' | 'color'; value: string; remove: Partial<ListingFilters> }
  | { key: 'price'; kind: 'price'; min?: number; max?: number; remove: Partial<ListingFilters> }
  | { key: 'stock'; kind: 'inStock'; remove: Partial<ListingFilters> };

export function isPriceFiltered(f: ListingFilters): boolean {
  return f.minPrice !== undefined || f.maxPrice !== undefined;
}

/** True when the facets span a real price range (more than a single price). */
export function hasPriceRange({ price }: Facets): boolean {
  return price.min !== null && price.max !== null && price.max > price.min;
}

/**
 * A control is shown when the facets offer options for it, or when the shopper
 * already filters by it (so the filter can still be changed or removed).
 */
export function filterAvailability(facets: Facets, filters: ListingFilters): FilterAvailability {
  return {
    sizes: facets.sizes.length > 0 || !!filters.sizes?.length,
    colors: facets.colors.length > 0 || !!filters.colors?.length,
    price: hasPriceRange(facets) || isPriceFiltered(filters),
  };
}

/**
 * Facet options followed by selected values the facets no longer offer (e.g. a
 * size that just sold out), so the shopper can still see and remove them.
 */
export function withSelectedOptions(options: FilterOption[], selected: readonly string[]): FilterOption[] {
  const offered = new Set(options.map((o) => o.value));
  const merged = [...options];
  for (const value of selected) {
    if (!offered.has(value)) merged.push({ value, count: 0 });
  }
  return merged;
}

/** Input text for an optional price bound ('' = no bound). */
export function priceInputValue(value: number | undefined): string {
  return value !== undefined ? String(value) : '';
}

/** Price input text -> whole shekels; blank, invalid or negative input means "no bound". */
export function parsePriceInput(value: string): number | undefined {
  const n = Number(value);
  return value.trim() === '' || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n);
}

/** Parse the "from" / "to" inputs, swapping them when entered the wrong way round. */
export function priceRangeFromInputs(from: string, to: string): { min?: number; max?: number } {
  const min = parsePriceInput(from);
  const max = parsePriceInput(to);
  if (min !== undefined && max !== undefined && min > max) return { min: max, max: min };
  return { min, max };
}

/** Active filters as removable chips, in display order: sizes, colours, price, stock. */
export function activeFilterChips(filters: ListingFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const value of filters.sizes ?? []) {
    chips.push({ key: `s-${value}`, kind: 'size', value, remove: { sizes: toggleValue(filters.sizes, value) } });
  }
  for (const value of filters.colors ?? []) {
    chips.push({ key: `c-${value}`, kind: 'color', value, remove: { colors: toggleValue(filters.colors, value) } });
  }
  if (isPriceFiltered(filters)) {
    chips.push({
      key: 'price',
      kind: 'price',
      min: filters.minPrice,
      max: filters.maxPrice,
      remove: { minPrice: undefined, maxPrice: undefined },
    });
  }
  if (filters.inStock) chips.push({ key: 'stock', kind: 'inStock', remove: { inStock: undefined } });
  return chips;
}
