import type { FieldErrors } from '../product-form-errors';
import { stockSummary, type Variant } from './stock-variants';
import { toNum } from './product-payload';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** next-intl translator scoped to `admin.productForm`. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

type ProductFields = {
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  categoryId: string;
  isActive: boolean;
  variants: Variant[];
};

function validateVariants(variants: Variant[], base: number, t: Translate): FieldErrors {
  const errors: FieldErrors = {};
  const e = (key: string) => t(`errors.${key}`);
  const skus = new Set<string>();
  const combos = new Set<string>();
  variants.forEach((v, i) => {
    const at = (field: string) => `variants.${i}.${field}`;
    if (!v.isActive && v.id) return; // a saved size that was switched off is kept as-is
    const color = v.color.trim();
    const size = v.size.trim();
    const sku = v.sku.trim();
    if (!color) errors[at('color')] = e('required');
    if (!size) errors[at('size')] = e('required');
    if (!sku) errors[at('sku')] = e('required');
    else if (skus.has(sku.toLowerCase())) errors[at('sku')] = e('skuDuplicate');
    skus.add(sku.toLowerCase());
    if (color && size) {
      const combo = `${color.toLowerCase()}|${size.toLowerCase()}`;
      if (combos.has(combo)) errors[at('size')] = e('variantDuplicate');
      combos.add(combo);
    }
    if (v.trackInventory !== false && (!Number.isInteger(v.stockQuantity) || v.stockQuantity < 0)) {
      errors[at('stockQuantity')] = e('mustBeNonNegative');
    }
    const override = toNum(v.priceOverride);
    if (override !== null && !(override > 0)) errors[at('priceOverride')] = e('mustBePositive');
    const sale = toNum(v.salePrice);
    if (sale !== null) {
      if (!(sale > 0)) errors[at('salePrice')] = e('mustBePositive');
      else if (sale >= (override ?? base)) errors[at('salePrice')] = e('saleBelowPrice');
    }
    if (v.saleStart && v.saleEnd && new Date(v.saleEnd) <= new Date(v.saleStart)) {
      errors[at('saleEnd')] = e('saleDateRange');
    }
  });
  return errors;
}

/** Client-side checks run before saving (and live after the first save attempt). */
export function validateProduct(f: ProductFields, t: Translate): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.nameEn.trim()) errors.nameEn = t('validation.nameEnRequired');
  if (!f.nameHe.trim()) errors.nameHe = t('validation.nameHeRequired');
  if (!f.slug.trim()) errors.slug = t('validation.slugRequired');
  else if (!SLUG_PATTERN.test(f.slug.trim())) errors.slug = t('errors.slugInvalid');
  const base = parseFloat(f.basePrice);
  if (!f.basePrice) errors.basePrice = t('validation.priceRequired');
  else if (!(base > 0)) errors.basePrice = t('validation.pricePositive');
  if (!f.categoryId) errors.categoryId = t('validation.categoryRequired');
  if (f.isActive && stockSummary(f.variants).sizes === 0) errors.variants = t('errors.noSizes');
  return { ...errors, ...validateVariants(f.variants, base, t) };
}
