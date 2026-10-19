import type { SortOption } from './types';

export const SORT_OPTIONS: SortOption[] = ['newest', 'price-asc', 'price-desc'];
export const PAGE_SIZE = 12;
export const MAX_SEARCH_LENGTH = 100;
/** Same caps as the API (`catalog-filters.ts`). */
export const MAX_FILTER_VALUES = 20;
export const MAX_FILTER_PRICE = 100_000;

/** Shopper-selected listing filters; all optional, kept in the URL. */
export type ListingFilters = {
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
};

export type ListingQuery = { sort: SortOption; page: number; type?: string; q?: string } & ListingFilters;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?sizes=M,L` (or repeated params) -> ['M', 'L']; trimmed, de-duplicated, capped. */
export function parseList(raw: string | string[] | undefined, maxLength = 50): string[] | undefined {
  if (raw === undefined) return undefined;
  const joined = Array.isArray(raw) ? raw.join(',') : raw;
  const values = [
    ...new Set(
      joined
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= maxLength),
    ),
  ].slice(0, MAX_FILTER_VALUES);
  return values.length ? values : undefined;
}

export function parsePrice(raw: string | string[] | undefined): number | undefined {
  const value = first(raw)?.trim();
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(MAX_FILTER_PRICE, Math.round(n));
}

/** Parse and sanitise listing search params (?q=&sort=&page=&type=&sizes=&colors=&minPrice=&maxPrice=&inStock=). */
export function parseListingQuery(raw: RawParams): ListingQuery {
  const sortRaw = first(raw.sort);
  const sort = SORT_OPTIONS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest';
  const pageNum = parseInt(first(raw.page) ?? '1', 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 500) : 1;
  const type = first(raw.type)?.trim() || undefined;
  const q = first(raw.q)?.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_LENGTH) || undefined;

  let minPrice = parsePrice(raw.minPrice);
  let maxPrice = parsePrice(raw.maxPrice);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const inStockRaw = first(raw.inStock);
  const query: ListingQuery = { sort, page, type, q };
  const filters: ListingFilters = {
    sizes: parseList(raw.sizes, 20),
    colors: parseList(raw.colors, 50),
    minPrice,
    maxPrice,
    inStock: inStockRaw === '1' || inStockRaw === 'true' ? true : undefined,
  };
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) (query as Record<string, unknown>)[key] = value;
  }
  return query;
}

/** Build a listing href, dropping defaults so canonical URLs stay clean. */
export function listingHref(basePath: string, q: Partial<ListingQuery>): string {
  const qs = new URLSearchParams();
  if (q.q) qs.set('q', q.q);
  if (q.type) qs.set('type', q.type);
  if (q.sizes?.length) qs.set('sizes', q.sizes.join(','));
  if (q.colors?.length) qs.set('colors', q.colors.join(','));
  if (q.minPrice !== undefined) qs.set('minPrice', String(q.minPrice));
  if (q.maxPrice !== undefined) qs.set('maxPrice', String(q.maxPrice));
  if (q.inStock) qs.set('inStock', '1');
  if (q.sort && q.sort !== 'newest') qs.set('sort', q.sort);
  if (q.page && q.page > 1) qs.set('page', String(q.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Number of active filter groups (sizes, colors, price, in stock). */
export function activeFilterCount(q: ListingFilters): number {
  return (
    (q.sizes?.length ? 1 : 0) +
    (q.colors?.length ? 1 : 0) +
    (q.minPrice !== undefined || q.maxPrice !== undefined ? 1 : 0) +
    (q.inStock ? 1 : 0)
  );
}

/** A new query with the filter patch applied; any filter change goes back to page 1. */
export function withFilters(q: ListingQuery, patch: Partial<ListingFilters>): ListingQuery {
  const next: ListingQuery = { ...q, ...patch, page: 1 };
  if (!next.sizes?.length) delete next.sizes;
  if (!next.colors?.length) delete next.colors;
  if (next.minPrice === undefined) delete next.minPrice;
  if (next.maxPrice === undefined) delete next.maxPrice;
  if (!next.inStock) delete next.inStock;
  return next;
}

/** Same query without any filters (sort, sub-category and search are kept). */
export function clearFilters(q: ListingQuery): ListingQuery {
  return withFilters(q, {
    sizes: undefined,
    colors: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    inStock: undefined,
  });
}

/** Adds or removes a value from a multi-select filter list. */
export function toggleValue(list: string[] | undefined, value: string): string[] | undefined {
  const current = list ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.length ? next : undefined;
}

/** Query-string params the API understands for the given filters. */
export function filterApiParams(f: ListingFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.sizes?.length) params.sizes = f.sizes.join(',');
  if (f.colors?.length) params.colors = f.colors.join(',');
  if (f.minPrice !== undefined) params.minPrice = String(f.minPrice);
  if (f.maxPrice !== undefined) params.maxPrice = String(f.maxPrice);
  if (f.inStock) params.inStock = 'true';
  return params;
}
