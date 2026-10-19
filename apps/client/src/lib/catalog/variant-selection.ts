import type { ErrorMessage } from '../shop-errors';
import { availableQty, isInStock, variantPrice } from './pricing';
import type { Product, ProductImage, Variant } from './types';

/** A product image with a guaranteed id (used as a React key and gallery identity). */
export type GalleryImage = ProductImage & { id: string };

/** What the shopper picked on the product page, plus the last add-to-bag error for that pick. */
export type VariantSelection = { color: string; size: string; quantity: number; addError: ErrorMessage | null };

/** The selection checked against the current variants (sizes and quantity kept valid). */
export type ResolvedSelection = VariantSelection & {
  /** Variants of the selected colour, in size-set order. */
  sizeOptions: Variant[];
  variant: Variant | undefined;
  maxQuantity: number;
};

export type SelectionAction =
  | { type: 'selectColor'; color: string; variants: Variant[] }
  | { type: 'selectSize'; size: string; variants: Variant[] }
  | { type: 'changeQuantity'; delta: 1 | -1; variants: Variant[] }
  | { type: 'setAddError'; error: ErrorMessage | null };

/** Variants the shop sells (hidden ones are dropped). */
export function activeVariants(product: Pick<Product, 'variants'>): Variant[] {
  return product.variants.filter((v) => v.isActive !== false);
}

/** Distinct values of one variant field, in first-seen order. */
export function distinctValues(variants: Variant[], field: 'color' | 'size'): string[] {
  return [...new Set(variants.map((v) => v[field]))];
}

/** The colour to show first: the first one in stock, else the first one. */
export function defaultColor(variants: Variant[]): string {
  return (variants.find(isInStock) ?? variants[0])?.color ?? '';
}

export function variantsForColor(variants: Variant[], color: string): Variant[] {
  return variants.filter((v) => v.color === color);
}

/**
 * Keep a valid size selected: the current one if this colour has it (and it is in
 * stock, or nothing is), else the first size in stock, else the first size.
 */
export function resolveSize(options: Variant[], size: string): string {
  if (options.length === 0) return size;
  const current = options.find((v) => v.size === size);
  if (current && (isInStock(current) || !options.some(isInStock))) return size;
  return (options.find(isInStock) ?? options[0]).size;
}

/** Quantity between 1 and what is available (at least 1, even when sold out). */
export function clampQuantity(quantity: number, max: number): number {
  return Math.max(1, Math.min(quantity, max || 1));
}

export function initialSelection(variants: Variant[]): VariantSelection {
  const color = defaultColor(variants);
  return { color, size: resolveSize(variantsForColor(variants, color), ''), quantity: 1, addError: null };
}

export function resolveSelection(selection: VariantSelection, variants: Variant[]): ResolvedSelection {
  const sizeOptions = variantsForColor(variants, selection.color);
  const size = resolveSize(sizeOptions, selection.size);
  const variant = sizeOptions.find((v) => v.size === size);
  const maxQuantity = variant ? availableQty(variant) : 0;
  return {
    color: selection.color,
    size,
    quantity: clampQuantity(selection.quantity, maxQuantity),
    addError: selection.addError,
    sizeOptions,
    variant,
    maxQuantity,
  };
}

/** Picking another colour / size: an add-to-bag error only applies to the variant it was for. */
function select(current: ResolvedSelection, color: string, size: string, quantity: number): VariantSelection {
  const sameVariant = color === current.color && size === current.size;
  return { color, size, quantity, addError: sameVariant ? current.addError : null };
}

/**
 * Product-page selection state. Selection actions carry the live variants so
 * every transition starts from a valid selection. When a colour change forces a
 * different size, the quantity starts over at 1; otherwise it is clamped to the
 * new variant's stock.
 */
export function selectionReducer(state: VariantSelection, action: SelectionAction): VariantSelection {
  if (action.type === 'setAddError') return { ...state, addError: action.error };
  const current = resolveSelection(state, action.variants);
  switch (action.type) {
    case 'selectColor': {
      const options = variantsForColor(action.variants, action.color);
      const size = resolveSize(options, current.size);
      const variant = size === current.size ? options.find((v) => v.size === size) : undefined;
      return select(current, action.color, size, variant ? clampQuantity(current.quantity, availableQty(variant)) : 1);
    }
    case 'selectSize': {
      const variant = current.sizeOptions.find((v) => v.size === action.size);
      return select(current, current.color, action.size, clampQuantity(current.quantity, variant ? availableQty(variant) : 0));
    }
    case 'changeQuantity': {
      const quantity =
        action.delta > 0 ? Math.min(Math.max(1, current.maxQuantity), current.quantity + 1) : Math.max(1, current.quantity - 1);
      return { ...state, color: current.color, size: current.size, quantity };
    }
  }
}

/** The price to show: the selected variant's, else the lowest on offer, else the base price. */
export function displayPrice(
  variant: Variant | undefined,
  variants: Variant[],
  basePrice: string,
): { current: number; original: number | null } {
  if (variant) return variantPrice(variant, basePrice);
  let lowest: { current: number; original: number | null } | undefined;
  for (const v of variants) {
    const price = variantPrice(v, basePrice);
    if (!lowest || price.current < lowest.current) lowest = price;
  }
  return lowest ?? { current: parseFloat(basePrice), original: null };
}

/** The selected colour's images (plus colour-less ones); all images when none match. */
export function galleryImagesFor(images: ProductImage[], color: string): GalleryImage[] {
  const all = images.map((img, i) => ({ ...img, id: img.id ?? `img-${i}` }));
  const forColor = all.filter((img) => !img.color || img.color === color);
  return forColor.length > 0 ? forColor : all;
}
