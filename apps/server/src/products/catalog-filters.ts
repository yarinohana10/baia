import { Prisma } from '../generated/prisma';

/**
 * Storefront listing filters (category / search / new-arrivals pages).
 *
 * Shared rules:
 * - "In stock" = an active variant that is untracked (unlimited) or has
 *   stockQuantity > 0 (same rule as `common/stock.ts`).
 * - A size filter only matches sizes that are in stock right now; when sizes
 *   and colors are both given, one variant must match both (e.g. "M in red").
 * - Price filters/sorting use the product's *effective* price: the lowest
 *   price a shopper can pay across its active variants (live sale price, else
 *   the variant override, else the base price).
 */
export type CatalogFilters = {
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
};

export const MAX_FILTER_VALUES = 20;
export const MAX_FILTER_PRICE = 100_000;

/** Comma list from the query string: trimmed, de-duplicated, length-capped. */
export function parseList(raw: string | string[] | undefined, maxLength: number): string[] | undefined {
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

/** Non-negative price from the query string; anything else is ignored. */
export function parsePrice(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(MAX_FILTER_PRICE, Math.round(n * 100) / 100);
}

export function parseCatalogFilters(query: {
  sizes?: string | string[];
  colors?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
}): CatalogFilters {
  let minPrice = parsePrice(query.minPrice);
  let maxPrice = parsePrice(query.maxPrice);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const filters: CatalogFilters = {
    sizes: parseList(query.sizes, 20),
    colors: parseList(query.colors, 50),
    minPrice,
    maxPrice,
    inStock: query.inStock === 'true' || query.inStock === '1' ? true : undefined,
  };
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as CatalogFilters;
}

export const hasPriceFilter = (f: CatalogFilters) => f.minPrice !== undefined || f.maxPrice !== undefined;

const needsStock = (f: CatalogFilters) => !!f.inStock || !!f.sizes?.length;
const hasVariantFilter = (f: CatalogFilters) => needsStock(f) || !!f.colors?.length;

/** Prisma `where` fragment for the variant-level filters (sizes / colors / inStock). */
export function variantWhere(f: CatalogFilters): Prisma.ProductWhereInput | null {
  if (!hasVariantFilter(f)) return null;
  const some: Prisma.ProductVariantWhereInput = { isActive: true };
  if (f.sizes?.length) some.size = { in: f.sizes };
  if (f.colors?.length) some.color = { in: f.colors };
  if (needsStock(f)) some.OR = [{ trackInventory: false }, { stockQuantity: { gt: 0 } }];
  return { variants: { some } };
}

/** SQL: an active variant can be bought right now. Expects alias `v`. */
export const IN_STOCK_SQL = Prisma.sql`(v."trackInventory" = false OR v."stockQuantity" > 0)`;

/**
 * Lateral join exposing `ep.min_price`: the lowest effective price across the
 * product's active variants (NULL when it has none — callers COALESCE to the
 * base price). Expects the product alias `p`.
 */
export const EFFECTIVE_PRICE_JOIN = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MIN(
      CASE
        WHEN v."salePrice" IS NOT NULL
          AND (v."saleStart" IS NULL OR v."saleStart" <= NOW())
          AND (v."saleEnd" IS NULL OR v."saleEnd" >= NOW())
        THEN v."salePrice"
        ELSE COALESCE(v."priceOverride", p."basePrice")
      END
    ) AS min_price
    FROM product_variants v
    WHERE v."productId" = p.id AND v."isActive" = true
  ) ep ON true`;

export const EFFECTIVE_PRICE_SQL = Prisma.sql`COALESCE(ep.min_price, p."basePrice")`;

export type ListingScope = { categoryIds: string[] | null; search?: string; featured?: boolean };

export function escapeLike(search: string) {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** SQL conditions on `products p` for the listing scope (active, category, search, featured). */
export function scopeConditions(scope: ListingScope): Prisma.Sql[] {
  const conditions = [Prisma.sql`p."isActive" = true`];
  if (scope.categoryIds) {
    conditions.push(Prisma.sql`p."categoryId" IN (${Prisma.join(scope.categoryIds)})`);
  }
  if (scope.search) {
    const pattern = escapeLike(scope.search);
    conditions.push(Prisma.sql`(p."nameEn" ILIKE ${pattern} OR p."nameHe" ILIKE ${pattern})`);
  }
  if (scope.featured) conditions.push(Prisma.sql`p."isFeatured" = true`);
  return conditions;
}

/**
 * SQL conditions for the filters. Price conditions reference `ep`, so the
 * query must include EFFECTIVE_PRICE_JOIN.
 */
export function filterConditions(f: CatalogFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (hasVariantFilter(f)) {
    const parts = [Prisma.sql`v."productId" = p.id`, Prisma.sql`v."isActive" = true`];
    if (f.sizes?.length) parts.push(Prisma.sql`v.size IN (${Prisma.join(f.sizes)})`);
    if (f.colors?.length) parts.push(Prisma.sql`v.color IN (${Prisma.join(f.colors)})`);
    if (needsStock(f)) parts.push(IN_STOCK_SQL);
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM product_variants v WHERE ${Prisma.join(parts, ' AND ')})`);
  }
  if (f.minPrice !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE_SQL} >= ${f.minPrice}`);
  if (f.maxPrice !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE_SQL} <= ${f.maxPrice}`);
  return conditions;
}
