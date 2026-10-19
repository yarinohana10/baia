import { LOW_STOCK_THRESHOLD } from '@/components/admin/product-form/stock-variants';
import type { ProductVariant } from './types';

export type StockStatus = 'no_sizes' | 'in_stock' | 'low_stock' | 'out_of_stock';

export type StockSummary = {
  status: StockStatus;
  /** Active sizes. */
  sizes: number;
  /** Total of tracked active sizes. */
  tracked: number;
  /** Active sizes that are tracked. */
  trackedCount: number;
  /** Active sizes with unlimited stock. */
  unlimitedCount: number;
};

/** Stock badge data for the products list, from the product's variants. */
export function getStockSummary(variants: ProductVariant[]): StockSummary {
  let sizes = 0;
  let tracked = 0;
  let trackedCount = 0;
  let anyLow = false;
  for (const v of variants) {
    if (!v.isActive) continue;
    sizes += 1;
    if (v.trackInventory === false) continue;
    trackedCount += 1;
    tracked += v.stockQuantity;
    if (v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD) anyLow = true;
  }
  const base = { sizes, tracked, trackedCount, unlimitedCount: sizes - trackedCount };

  if (sizes === 0) return { ...base, status: 'no_sizes' };
  // Any unlimited size means the product can always be bought.
  if (base.unlimitedCount === 0 && tracked === 0) return { ...base, status: 'out_of_stock' };
  if (anyLow) return { ...base, status: 'low_stock' };
  return { ...base, status: 'in_stock' };
}
