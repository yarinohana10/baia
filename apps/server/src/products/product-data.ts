import { Prisma } from '../generated/prisma';
import { variantAvailability, type Availability } from '../common/stock';
import { compareSizes } from './size-sets';
import type { UpdateVariantDto, VariantDto } from './dto/product.dto';

/** Pure mapping helpers for products: DTO -> Prisma data, availability, ordering. */

export type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export function toNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return value.toNumber();
}

export function decimalOrNull(value: number | null | undefined) {
  return value === null || value === undefined ? null : new Prisma.Decimal(value);
}

export function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

/** Product images in gallery order, with the storage key used to build their URL. */
export const IMAGE_INCLUDE = { orderBy: { sortOrder: 'asc' }, include: { upload: true } } as const;

/** Only the fields present in the DTO (partial updates). */
export function variantData(v: VariantDto | UpdateVariantDto) {
  const data: Prisma.ProductVariantUncheckedUpdateInput = {};
  if (v.color !== undefined) data.color = v.color;
  if (v.size !== undefined) data.size = v.size;
  if (v.sku !== undefined) data.sku = v.sku;
  // With expectedStockQuantity the edit is applied as a delta (see ProductsService.editStock).
  if (v.stockQuantity !== undefined && v.expectedStockQuantity === undefined) data.stockQuantity = v.stockQuantity;
  if (v.trackInventory !== undefined) data.trackInventory = v.trackInventory;
  if (v.priceOverride !== undefined) data.priceOverride = decimalOrNull(v.priceOverride);
  if (v.salePrice !== undefined) data.salePrice = decimalOrNull(v.salePrice);
  if (v.saleStart !== undefined) data.saleStart = dateOrNull(v.saleStart);
  if (v.saleEnd !== undefined) data.saleEnd = dateOrNull(v.saleEnd);
  if (v.isActive !== undefined) data.isActive = v.isActive;
  return data;
}

/** A new variant, with the defaults a new size starts with. */
export function newVariantData(v: VariantDto) {
  return {
    color: v.color,
    size: v.size,
    sku: v.sku,
    stockQuantity: v.stockQuantity,
    trackInventory: v.trackInventory ?? true,
    priceOverride: decimalOrNull(v.priceOverride),
    salePrice: decimalOrNull(v.salePrice),
    saleStart: dateOrNull(v.saleStart),
    saleEnd: dateOrNull(v.saleEnd),
    isActive: v.isActive ?? true,
  };
}

/**
 * Adds the computed `availability` to a product and each of its variants
 * (in_stock | low_stock | sold_out | back_soon | hidden). The product is
 * back_soon when an Admin set it or every purchasable size is sold out
 * (shown to customers as Back Soon too, but kept apart for the admin).
 */
export function withAvailability<
  T extends {
    isActive: boolean;
    backSoon: boolean;
    variants?: { isActive: boolean; trackInventory: boolean; stockQuantity: number }[];
  },
>(
  product: T,
  threshold: number,
): T & { availability: Availability; variants: (NonNullable<T['variants']>[number] & { availability: Availability })[] } {
  const variants = (product.variants ?? []).map((v) => ({
    ...v,
    availability: variantAvailability(v, product, threshold),
  }));
  const live = variants.filter((v) => v.isActive);
  let availability: Availability;
  if (!product.isActive) availability = 'hidden';
  else if (product.backSoon) availability = 'back_soon';
  else if (live.length === 0 || live.every((v) => v.availability === 'sold_out')) availability = 'sold_out';
  else if (live.some((v) => v.availability === 'in_stock')) availability = 'in_stock';
  else availability = 'low_stock';
  return { ...product, availability, variants } as never;
}

/** Variants by color, then in the product's size-set order (S, M, L…). */
export function sortVariantsBySize<
  T extends { variants?: { color: string; size: string }[]; sizeSet?: { sizes: string[] } | null },
>(product: T): T {
  if (!product.variants) return product;
  const order = product.sizeSet?.sizes ?? [];
  const variants = [...product.variants].sort(
    (a, b) => a.color.localeCompare(b.color) || compareSizes(a.size, b.size, order),
  );
  return { ...product, variants };
}
