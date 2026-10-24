import type { FieldError } from '../common/validation';

/** Business rules that span fields or rows (the DTOs cover per-field rules). */

export type PricingFields = {
  priceOverride?: number | null;
  salePrice?: number | null;
  saleStart?: string | Date | null;
  saleEnd?: string | Date | null;
};

/** A visible product with no sizes would show as "out of stock" in the store. */
export const NO_ACTIVE_SIZES_ERROR: FieldError = {
  field: 'variants',
  code: 'required',
  message: 'Add at least one size with stock, or save the product as hidden',
};

/** The sale price must be below the variant's price, and the sale must end after it starts. */
export function pricingErrors(v: PricingFields, basePrice: number, path: string): FieldError[] {
  const at = (field: string) => (path ? `${path}.${field}` : field);
  const errors: FieldError[] = [];
  const effective = v.priceOverride ?? basePrice;
  if (v.salePrice !== null && v.salePrice !== undefined && v.salePrice >= effective) {
    errors.push({
      field: at('salePrice'),
      code: 'saleBelowPrice',
      message: `salePrice must be lower than the price (${effective})`,
    });
  }
  if (v.saleStart && v.saleEnd && new Date(v.saleEnd).getTime() <= new Date(v.saleStart).getTime()) {
    errors.push({ field: at('saleEnd'), code: 'saleDateRange', message: 'saleEnd must be after saleStart' });
  }
  return errors;
}

/** Pricing rules per variant, plus SKUs and color+size combinations unique within the payload. */
export function variantRuleErrors(
  variants: (PricingFields & { sku?: string; color?: string; size?: string })[],
  basePrice: number,
  pathPrefix = 'variants',
): FieldError[] {
  const errors: FieldError[] = [];
  const skus = new Set<string>();
  const combos = new Set<string>();

  variants.forEach((v, i) => {
    const path = pathPrefix ? `${pathPrefix}.${i}` : '';
    const at = (field: string) => (path ? `${path}.${field}` : field);

    errors.push(...pricingErrors(v, basePrice, path));

    if (v.sku) {
      const key = v.sku.toLowerCase();
      if (skus.has(key)) {
        errors.push({ field: at('sku'), code: 'duplicate', message: `SKU "${v.sku}" is used more than once` });
      } else {
        skus.add(key);
      }
    }
    if (v.color && v.size) {
      const key = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
      if (combos.has(key)) {
        errors.push({
          field: at('size'),
          code: 'duplicateCombination',
          message: `Color "${v.color}" / size "${v.size}" is used more than once`,
        });
      } else {
        combos.add(key);
      }
    }
  });
  return errors;
}
