import type { SortOption } from './types';

export const SORT_OPTIONS: SortOption[] = ['newest', 'price-asc', 'price-desc'];
export const PAGE_SIZE = 12;

export type ListingQuery = { sort: SortOption; page: number; type?: string };

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parse and sanitise listing search params (?sort=&page=&type=). */
export function parseListingQuery(raw: RawParams): ListingQuery {
  const sortRaw = first(raw.sort);
  const sort = SORT_OPTIONS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : 'newest';
  const pageNum = parseInt(first(raw.page) ?? '1', 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 500) : 1;
  const type = first(raw.type)?.trim() || undefined;
  return { sort, page, type };
}

/** Build a listing href, dropping defaults so canonical URLs stay clean. */
export function listingHref(basePath: string, q: Partial<ListingQuery>): string {
  const qs = new URLSearchParams();
  if (q.type) qs.set('type', q.type);
  if (q.sort && q.sort !== 'newest') qs.set('sort', q.sort);
  if (q.page && q.page > 1) qs.set('page', String(q.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
