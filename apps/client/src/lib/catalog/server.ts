import type { Category, Product, ProductList, SiteConfig, SortOption, CardProduct, Facets } from './types';
import { filterApiParams, type ListingFilters } from './query';
import { serverApiUrl } from '../api-urls';

/**
 * Server-side catalogue reads. Uses Next's data cache (ISR) with tags so an admin
 * mutation can call revalidateTag('products' | 'categories' | 'site-config').
 * Every read fails soft (returns empty) so a slow/down API never breaks a build or page.
 */

// Private-network API address on Railway (API_INTERNAL_URL), else the public URL.
const API_URL = serverApiUrl();

export const REVALIDATE_SECONDS = 300;

/**
 * Cache tags on every catalogue fetch below. `POST /api/revalidate` (called by
 * `revalidateCatalog()` after admin mutations) invalidates all of them, so
 * hidden products, price changes and settings show up immediately instead of
 * after REVALIDATE_SECONDS.
 */
export const CATALOG_TAGS = ['products', 'categories', 'site-config'] as const;

async function get<T>(path: string, tags: string[], fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories', ['categories'], []);
}

export async function getCategory(slug: string): Promise<Category | null> {
  return get<Category | null>(`/categories/${encodeURIComponent(slug)}`, ['categories', `category:${slug}`], null);
}

export function getProducts(params: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
  filters?: ListingFilters;
} = {}): Promise<ProductList> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.search) qs.set('search', params.search);
  for (const [key, value] of Object.entries(filterApiParams(params.filters ?? {}))) qs.set(key, value);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 12));
  qs.set('sort', params.sort ?? 'newest');
  const empty: ProductList = { products: [], total: 0, page: 1, limit: params.limit ?? 12, totalPages: 0 };
  return get<ProductList>(`/products?${qs}`, ['products'], empty);
}

const EMPTY_FACETS: Facets = { sizes: [], colors: [], price: { min: null, max: null } };

/** Filter options (in-stock sizes, colors, price range) for a listing scope. */
export function getFacets(params: { categoryId?: string; search?: string } = {}): Promise<Facets> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.search) qs.set('search', params.search);
  return get<Facets>(`/products/facets?${qs}`, ['products'], EMPTY_FACETS);
}

/** "You may also like" products for a product page. */
export function getRelatedProducts(slug: string, limit = 8): Promise<Product[]> {
  return get<Product[]>(
    `/products/${encodeURIComponent(slug)}/related?limit=${limit}`,
    ['products', `product:${slug}`],
    [],
  );
}

export function getProduct(slug: string): Promise<Product | null> {
  return get<Product | null>(`/products/${encodeURIComponent(slug)}`, ['products', `product:${slug}`], null);
}

export function getSiteConfig(): Promise<SiteConfig | null> {
  return get<SiteConfig | null>('/site-config', ['site-config'], null);
}

export function toCardProduct(p: Product): CardProduct {
  return {
    id: p.id,
    nameHe: p.nameHe,
    nameEn: p.nameEn,
    slug: p.slug,
    basePrice: p.basePrice,
    createdAt: p.createdAt,
    images: p.images.slice(0, 2).map((i) => ({ url: i.url, color: i.color ?? null })),
    variants: p.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      salePrice: v.salePrice,
      saleStart: v.saleStart,
      saleEnd: v.saleEnd,
      priceOverride: v.priceOverride,
      stockQuantity: v.stockQuantity,
      trackInventory: v.trackInventory,
    })),
  };
}
