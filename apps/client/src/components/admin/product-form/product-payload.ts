import type { ImageItem } from '../ProductImagesManager';
import { contentPayload } from './product-content';
import type { ServerImage } from './types';
import type { Variant } from './stock-variants';
import type { ProductFormValues } from '@/hooks/admin/product-form';

export const toNum = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? null : Number(value);

export function toImageItem(img: ServerImage): ImageItem {
  return {
    key: img.id,
    id: img.id,
    url: img.url,
    color: img.color ?? '',
    altTextHe: img.altTextHe ?? '',
    altTextEn: img.altTextEn ?? img.altText ?? '',
  };
}

/** An image's editable metadata as the API takes it (blank → null). */
export const imageMeta = (img: ImageItem) => ({
  color: img.color || null,
  altTextHe: img.altTextHe.trim() || null,
  altTextEn: img.altTextEn.trim() || null,
});

export function variantPayload(v: Variant) {
  return {
    ...(v.id ? { id: v.id } : {}),
    color: v.color.trim(),
    size: v.size.trim(),
    sku: v.sku.trim(),
    stockQuantity: v.stockQuantity,
    ...(v.id && v.loadedStock !== undefined ? { expectedStockQuantity: v.loadedStock } : {}),
    trackInventory: v.trackInventory !== false,
    priceOverride: toNum(v.priceOverride),
    salePrice: toNum(v.salePrice),
    saleStart: v.saleStart || null,
    saleEnd: v.saleEnd || null,
    isActive: v.isActive,
  };
}

/** Product + variants body for create / update (images are sent separately). */
export function productPayload(f: ProductFormValues) {
  return {
    nameHe: f.nameHe.trim(),
    nameEn: f.nameEn.trim(),
    descriptionHe: f.descHe.trim() || null,
    descriptionEn: f.descEn.trim() || null,
    ...contentPayload(f.content),
    slug: f.slug.trim(),
    basePrice: parseFloat(f.basePrice),
    categoryId: f.categoryId,
    sizeSetId: f.sizeSetId || null,
    isFeatured: f.isFeatured,
    isActive: f.isActive,
    backSoon: f.backSoon,
    variants: f.variants.map(variantPayload),
  };
}
