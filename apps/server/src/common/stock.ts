/** Stock rules shared by cart, checkout and admin reporting. */
export type StockFields = { stockQuantity: number; trackInventory: boolean };

/** Units a customer can buy right now; Infinity for unlimited-stock variants. */
export function availableStock(v: StockFields): number {
  return v.trackInventory ? Math.max(0, v.stockQuantity) : Number.POSITIVE_INFINITY;
}

export function hasStock(v: StockFields, quantity: number): boolean {
  return availableStock(v) >= quantity;
}

/** False when the product is Hidden or Back Soon, the variant is inactive, or tracked stock is short. */
export function isPurchasable(
  variant: StockFields & { isActive: boolean },
  product: { isActive: boolean; backSoon: boolean },
  qty: number,
): boolean {
  if (!product.isActive || product.backSoon || !variant.isActive) return false;
  return hasStock(variant, qty);
}

export type Availability = 'in_stock' | 'low_stock' | 'sold_out' | 'back_soon' | 'hidden';

/** Customer-facing state of one variant. sold_out is shown to customers as Back Soon too. */
export function variantAvailability(
  variant: StockFields & { isActive: boolean },
  product: { isActive: boolean; backSoon: boolean },
  lowStockThreshold: number,
): Availability {
  if (!product.isActive) return 'hidden';
  if (product.backSoon) return 'back_soon';
  if (!variant.isActive) return 'sold_out';
  if (!variant.trackInventory) return 'in_stock';
  if (variant.stockQuantity <= 0) return 'sold_out';
  if (variant.stockQuantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
